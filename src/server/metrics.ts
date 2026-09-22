type Counters = {
  httpRequests: number;
  httpErrors: number;
  llmCalls: number;
  llmErrors: number;
  llmRecoveries: number;
  cacheHits: number;
  cacheMisses: number;
  jobsRejected: number;
};

const counters: Counters = {
  httpRequests: 0,
  httpErrors: 0,
  llmCalls: 0,
  llmErrors: 0,
  llmRecoveries: 0,
  cacheHits: 0,
  cacheMisses: 0,
  jobsRejected: 0,
};

let inFlight = 0;
const latencies: number[] = [];
const LATENCY_WINDOW = 200;

export const metrics = {
  inc(name: keyof Counters, by = 1) {
    counters[name] += by;
  },
  beginRequest() {
    inFlight += 1;
    counters.httpRequests += 1;
    return Date.now();
  },
  endRequest(startedAt: number, status: number) {
    inFlight = Math.max(0, inFlight - 1);
    if (status >= 500) counters.httpErrors += 1;
    latencies.push(Date.now() - startedAt);
    if (latencies.length > LATENCY_WINDOW) latencies.shift();
  },
  inFlight() {
    return inFlight;
  },
  snapshot(extra: Record<string, unknown> = {}) {
    const sorted = [...latencies].sort((a, b) => a - b);
    const p = (q: number) =>
      sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))] ?? 0;
    return {
      counters: { ...counters },
      inFlight,
      latencyMs: {
        count: sorted.length,
        p50: p(0.5),
        p95: p(0.95),
        max: sorted[sorted.length - 1] ?? 0,
      },
      ...extra,
    };
  },
};
