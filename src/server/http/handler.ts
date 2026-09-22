import { boot } from "../container";
import { randomUUID } from "node:crypto";
import { ZodError, type ZodType } from "zod";
import { getConfig } from "../config";
import { runWithContext } from "../context";
import { AppError } from "../errors";
import { logger } from "../logger";
import { metrics } from "../metrics";
import { isShuttingDown } from "../shutdown";
import type { ApiErrorBody } from "@/lib/types";
import { readJsonBody } from "@/server/http/body";
import { clientIp, takeToken } from "@/server/http/rateLimit";

export type ApiResult = {
  status?: number;
  body: unknown;
  headers?: Record<string, string>;
};

export type ApiContext<TBody> = {
  request: Request;
  requestId: string;
  ip: string;
  params: Record<string, string>;
  body: TBody;
};

type HandleOptions<TBody> = {
  rateLimit: "llm" | "read" | "none";
  body?: ZodType<TBody>;
  allowDuringShutdown?: boolean;
};

const JSON_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
};

export function jsonResponse(
  body: unknown,
  status = 200,
  extra?: Record<string, string>,
): Response {
  return Response.json(body, {
    status,
    headers: { ...JSON_HEADERS, ...extra },
  });
}

export function errorToResponse(error: unknown, requestId: string): Response {
  if (error instanceof ZodError) {
    const message = error.issues[0]?.message || "Invalid request.";
    return jsonResponse(errorBody("validation", message, false, requestId), 400, {
      "X-Request-Id": requestId,
    });
  }

  if (error instanceof AppError) {
    const extra: Record<string, string> = { "X-Request-Id": requestId };
    if (error.code === "rate_limit") extra["Retry-After"] = "20";
    if (error.code === "unavailable") extra["Retry-After"] = "5";
    return jsonResponse(
      errorBody(error.code, error.message, error.retryable, requestId),
      error.status,
      extra,
    );
  }

  logger.error({
    msg: "http.unhandled",
    err: error instanceof Error ? error.message : "unknown",
    stack: error instanceof Error ? error.stack : undefined,
  });
  return jsonResponse(
    errorBody("internal", "Something went wrong on our side.", true, requestId),
    500,
    { "X-Request-Id": requestId },
  );
}

function errorBody(
  code: string,
  message: string,
  retryable: boolean,
  requestId: string,
): ApiErrorBody & { error: { request_id: string } } {
  return {
    error: { code, message, retryable, request_id: requestId },
  };
}

export function handle<TBody = undefined>(
  options: HandleOptions<TBody>,
  fn: (ctx: ApiContext<TBody>) => Promise<ApiResult>,
) {
  return async (
    request: Request,
    route?: { params?: Promise<Record<string, string>> },
  ): Promise<Response> => {
    const requestId =
      request.headers.get("x-request-id")?.trim() || randomUUID();
    const ip = clientIp(request);
    const routeName = new URL(request.url).pathname;
    const startedAt = metrics.beginRequest();

    return runWithContext(
      { requestId, route: routeName, method: request.method, ip },
      async () => {
        try {
          boot();
          if (isShuttingDown() && !options.allowDuringShutdown) {
            throw new AppError(
              "unavailable",
              "This instance is shutting down. Retry on another instance.",
            );
          }

          if (options.rateLimit !== "none") {
            const config = getConfig();
            const limit =
              options.rateLimit === "llm"
                ? config.RATE_LIMIT_LLM_PER_MIN
                : config.RATE_LIMIT_READ_PER_MIN;
            const result = takeToken(`${options.rateLimit}:${ip}`, limit);
            if (!result.ok) {
              throw new AppError(
                "rate_limit",
                `Too many requests. Try again in ${result.retryAfterSec}s.`,
              );
            }
          }

          const params = route?.params ? await route.params : {};
          let body = undefined as TBody;
          if (options.body) {
            const raw = await readJsonBody(request);
            body = options.body.parse(raw) as TBody;
          }

          const result = await fn({ request, requestId, ip, params, body });
          const status = result.status ?? 200;
          metrics.endRequest(startedAt, status);
          logger.info({
            msg: "http.access",
            method: request.method,
            route: routeName,
            status,
            duration_ms: Date.now() - startedAt,
          });
          return jsonResponse(result.body, status, {
            "X-Request-Id": requestId,
            ...result.headers,
          });
        } catch (error) {
          const response = errorToResponse(error, requestId);
          metrics.endRequest(startedAt, response.status);
          logger.warn({
            msg: "http.error",
            method: request.method,
            route: routeName,
            status: response.status,
            duration_ms: Date.now() - startedAt,
            code: error instanceof AppError ? error.code : "internal",
          });
          return response;
        }
      },
    );
  };
}
