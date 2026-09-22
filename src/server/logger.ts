import { getConfig } from "./config";
import { getRequestId } from "./context";

type Level = "debug" | "info" | "warn" | "error";

const rank: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const SECRET = /(api[_-]?key|authorization|token|secret|password|bearer)/i;

function redact(value: unknown): unknown {
  if (typeof value === "string") {
    if (value.length > 500) return `${value.slice(0, 500)}…`;
    return value;
  }
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map(redact);
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    out[key] = SECRET.test(key) ? "[redacted]" : redact(entry);
  }
  return out;
}

function emit(level: Level, fields: Record<string, unknown>): void {
  const config = getConfig();
  if (rank[level] < rank[config.LOG_LEVEL]) return;
  const safeFields = redact(fields);
  const line = {
    ts: new Date().toISOString(),
    level,
    service: "flexiple-sourcing",
    request_id: getRequestId() ?? undefined,
    env: config.NODE_ENV,
    ...(typeof safeFields === "object" && safeFields && !Array.isArray(safeFields)
      ? (safeFields as Record<string, unknown>)
      : { msg: safeFields }),
  };
  const serialized = JSON.stringify(line);
  if (level === "error") console.error(serialized);
  else if (level === "warn") console.warn(serialized);
  else console.info(serialized);
}

export const logger = {
  debug: (fields: Record<string, unknown>) => emit("debug", fields),
  info: (fields: Record<string, unknown>) => emit("info", fields),
  warn: (fields: Record<string, unknown>) => emit("warn", fields),
  error: (fields: Record<string, unknown>) => emit("error", fields),
};
