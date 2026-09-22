type Bucket = {
  tokens: number;
  updatedAt: number;
};

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;

export function takeToken(
  key: string,
  limit: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current) {
    buckets.set(key, { tokens: limit - 1, updatedAt: now });
    return { ok: true };
  }

  const recovered = ((now - current.updatedAt) / WINDOW_MS) * limit;
  const tokens = Math.min(limit, current.tokens + recovered);
  if (tokens < 1) {
    const retryAfterSec = Math.ceil(((1 - tokens) / limit) * (WINDOW_MS / 1000));
    buckets.set(key, { tokens, updatedAt: now });
    return { ok: false, retryAfterSec: Math.max(1, retryAfterSec) };
  }

  buckets.set(key, { tokens: tokens - 1, updatedAt: now });
  return { ok: true };
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return request.headers.get("x-real-ip")?.trim() || "local";
}
