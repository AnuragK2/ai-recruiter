import { Semaphore } from "./concurrency";
import { AppError } from "./errors";
import { metrics } from "./metrics";

export class JobQueue {
  private readonly semaphore: Semaphore;

  constructor(
    private readonly concurrency: number,
    private readonly maxQueued: number,
  ) {
    this.semaphore = new Semaphore(concurrency);
  }

  get snapshot() {
    return {
      concurrency: this.concurrency,
      active: this.semaphore.activeCount,
      queued: this.semaphore.queued,
    };
  }

  async submit<T>(fn: () => Promise<T>): Promise<T> {
    if (this.semaphore.queued >= this.maxQueued) {
      metrics.inc("jobsRejected");
      throw new AppError(
        "unavailable",
        "The search pipeline is at capacity. Wait a moment and retry.",
      );
    }
    return this.semaphore.run(fn);
  }
}
