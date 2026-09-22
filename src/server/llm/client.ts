import type { ZodType } from "zod";
import { getConfig } from "../config";
import { AppError } from "../errors";
import { logger } from "../logger";
import { metrics } from "../metrics";
import { REPAIR_SYSTEM } from "@/lib/llm/prompts";

type JsonSchema = Record<string, unknown>;

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

function requireKey(): string {
  const key = getConfig().OPENAI_API_KEY;
  if (!key) {
    throw new AppError(
      "config",
      "OPENAI_API_KEY is not set. Add it to .env.local and restart.",
      { retryable: false },
    );
  }
  return key;
}

function requireModel(): string {
  const model = getConfig().OPENAI_MODEL;
  if (!model) {
    throw new AppError(
      "config",
      "OPENAI_MODEL is not set. Add it to .env.local and restart.",
      { retryable: false },
    );
  }
  return model;
}

function chatCompletionsUrl(): string {
  const base = getConfig().OPENAI_BASE_URL.replace(/\/+$/, "");
  if (base.endsWith("/chat/completions")) return base;
  return `${base}/chat/completions`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const payload = fenced?.[1] ?? trimmed;
  const start = payload.indexOf("{");
  const end = payload.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new AppError("malformed", "The model did not return JSON.");
  }
  try {
    return JSON.parse(payload.slice(start, end + 1));
  } catch {
    throw new AppError("malformed", "The model returned invalid JSON.");
  }
}

type ResponseFormat =
  | { type: "json_object" }
  | {
      type: "json_schema";
      json_schema: { name: string; strict: boolean; schema: JsonSchema };
    };

async function chatRequest(
  messages: ChatMessage[],
  responseFormat: ResponseFormat,
): Promise<string> {
  const config = getConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.LLM_TIMEOUT_MS);

  try {
    const response = await fetch(chatCompletionsUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requireKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: requireModel(),
        temperature: 0.2,
        messages,
        response_format: responseFormat,
      }),
      signal: controller.signal,
    });

    let raw: ChatResponse = {};
    try {
      raw = (await response.json()) as ChatResponse;
    } catch {
      raw = {};
    }

    if (response.status === 429) {
      throw new AppError(
        "rate_limit",
        "The model is rate-limiting us. Wait a few seconds and retry.",
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new AppError("config", "The LLM provider rejected the API key.", {
        retryable: false,
      });
    }
    if (!response.ok) {
      throw new AppError(
        "provider",
        raw.error?.message || `Provider error (${response.status})`,
      );
    }

    const content = raw.choices?.[0]?.message?.content;
    if (!content) {
      throw new AppError("malformed", "The model returned an empty response.");
    }
    return content;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AppError("timeout", "The model took too long to respond.");
    }
    throw new AppError("provider", "Could not reach the model.", { cause: error });
  } finally {
    clearTimeout(timer);
  }
}

async function chat(
  messages: ChatMessage[],
  schema: JsonSchema,
  schemaName: string,
): Promise<string> {
  try {
    return await chatRequest(messages, {
      type: "json_schema",
      json_schema: { name: schemaName, strict: true, schema },
    });
  } catch (error) {
    const fallback =
      error instanceof AppError &&
      error.code === "provider" &&
      /json_schema|response_format|schema|structured/i.test(error.message);
    if (!fallback) throw error;
    logger.warn({ msg: "llm.json_schema_fallback", schemaName });
    return chatRequest(messages, { type: "json_object" });
  }
}

async function completeWithRepair<T>(
  system: string,
  user: string,
  schema: JsonSchema,
  schemaName: string,
  validator: ZodType<T>,
): Promise<{ data: T; recovered: boolean }> {
  const first = await chat(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    schema,
    schemaName,
  );

  const parsed = validator.safeParse(extractJson(first));
  if (parsed.success) return { data: parsed.data, recovered: false };

  const repaired = await chat(
    [
      { role: "system", content: REPAIR_SYSTEM },
      {
        role: "user",
        content: [
          "Required schema name: " + schemaName,
          "Validation issues: " + parsed.error.message.slice(0, 800),
          "Malformed output:",
          first.slice(0, 4000),
        ].join("\n\n"),
      },
    ],
    schema,
    schemaName,
  );

  const second = validator.safeParse(extractJson(repaired));
  if (!second.success) {
    throw new AppError(
      "malformed",
      "The model returned a response we could not validate, even after a retry.",
    );
  }
  return { data: second.data, recovered: true };
}

export async function structuredLlm<T>(options: {
  system: string;
  user: string;
  schema: JsonSchema;
  schemaName: string;
  validator: ZodType<T>;
}): Promise<{ data: T; recovered: boolean }> {
  const retries = getConfig().LLM_MAX_RETRIES;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const started = Date.now();
    metrics.inc("llmCalls");
    try {
      const result = await completeWithRepair(
        options.system,
        options.user,
        options.schema,
        options.schemaName,
        options.validator,
      );
      logger.info({
        msg: "llm.ok",
        schema: options.schemaName,
        recovered: result.recovered,
        duration_ms: Date.now() - started,
        attempt,
      });
      if (result.recovered) metrics.inc("llmRecoveries");
      return result;
    } catch (error) {
      lastError = error;
      metrics.inc("llmErrors");
      const retryable =
        error instanceof AppError &&
        (error.code === "rate_limit" ||
          error.code === "timeout" ||
          error.code === "provider");
      logger.warn({
        msg: "llm.fail",
        schema: options.schemaName,
        code: error instanceof AppError ? error.code : "internal",
        attempt,
        duration_ms: Date.now() - started,
      });
      if (!retryable || attempt === retries) throw error;
      const delay =
        error instanceof AppError && error.code === "rate_limit"
          ? 2500 * (attempt + 1)
          : 600 * (attempt + 1);
      await sleep(delay);
    }
  }

  throw lastError instanceof AppError
    ? lastError
    : new AppError("provider", "The model call failed.");
}
