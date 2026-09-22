import { generateSpec } from "@/lib/llm/generate";
import { refineSpec } from "@/lib/llm/refine";
import { scoreProfiles } from "@/lib/llm/score";
import type { Filters, RankedProfile, Rubric, Vote } from "@/lib/types";
import { CircuitBreaker } from "../circuit-breaker";
import { getConfig } from "../config";
import { JobQueue } from "../jobs";

export class LlmService {
  readonly circuit: CircuitBreaker;
  readonly queue: JobQueue;

  constructor() {
    const config = getConfig();
    this.circuit = new CircuitBreaker(
      config.CIRCUIT_FAILURE_THRESHOLD,
      config.CIRCUIT_COOLDOWN_MS,
    );
    this.queue = new JobQueue(config.LLM_CONCURRENCY, config.LLM_QUEUE_SIZE);
  }

  generate(query: string) {
    return this.run(() => generateSpec(query));
  }

  score(input: { query: string; rubric: Rubric; profiles: RankedProfile["profile"][] }) {
    return this.run(() => scoreProfiles(input));
  }

  refine(input: {
    query: string;
    filters: Filters;
    rubric: Rubric;
    page: RankedProfile[];
    votes: Vote[];
    message: string;
  }) {
    return this.run(() => refineSpec(input));
  }

  private run<T>(fn: () => Promise<T>): Promise<T> {
    return this.queue.submit(() => this.circuit.exec(fn));
  }
}
