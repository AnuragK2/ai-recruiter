import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  OPENAI_API_KEY: z.string().trim().min(1).optional(),
  OPENAI_BASE_URL: z
    .string()
    .trim()
    .min(1)
    .default("https://api.openai.com/v1"),
  OPENAI_MODEL: z.string().trim().min(1).optional(),
  LLM_TIMEOUT_MS: z.coerce.number().int().min(3_000).max(120_000).default(45_000),
  LLM_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  LLM_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(2),
  LLM_QUEUE_SIZE: z.coerce.number().int().min(1).max(200).default(24),
  RATE_LIMIT_LLM_PER_MIN: z.coerce.number().int().min(1).max(120).default(8),
  RATE_LIMIT_READ_PER_MIN: z.coerce.number().int().min(1).max(600).default(60),
  SESSION_TTL_MS: z.coerce
    .number()
    .int()
    .min(60_000)
    .default(2 * 60 * 60 * 1000),
  MAX_BODY_BYTES: z.coerce.number().int().min(1_024).max(1_048_576).default(32_768),
  PAGE_SIZE: z.coerce.number().int().min(1).max(10).default(5),
  SCORE_CAP: z.coerce.number().int().min(1).max(48).default(16),
  CIRCUIT_FAILURE_THRESHOLD: z.coerce.number().int().min(2).max(50).default(5),
  CIRCUIT_COOLDOWN_MS: z.coerce.number().int().min(1_000).max(180_000).default(30_000),
  SHUTDOWN_DRAIN_MS: z.coerce.number().int().min(1_000).max(60_000).default(15_000),
  FILTER_CACHE_TTL_MS: z.coerce.number().int().min(0).max(600_000).default(60_000),
  IDEMPOTENCY_TTL_MS: z.coerce.number().int().min(10_000).max(3_600_000).default(600_000),
});

export type AppConfig = z.infer<typeof envSchema>;

let cached: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".") || "env";
    throw new Error(`Invalid config: ${path} ${issue?.message ?? "failed validation"}`);
  }
  cached = Object.freeze(parsed.data);
  return cached;
}

export function resetConfigForTests(): void {
  cached = null;
}

export function llmReady(config: AppConfig = getConfig()): boolean {
  return Boolean(config.OPENAI_API_KEY && config.OPENAI_MODEL);
}
