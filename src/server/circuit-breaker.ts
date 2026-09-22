import { AppError } from "./errors";

type State = "closed" | "open" | "half_open";

export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  private state: State = "closed";

  constructor(
    private readonly threshold: number,
    private readonly cooldownMs: number,
  ) {}

  get snapshot() {
    return { state: this.state, failures: this.failures };
  }

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    this.precheck();
    try {
      const result = await fn();
      this.succeed();
      return result;
    } catch (error) {
      this.fail();
      throw error;
    }
  }

  private precheck(): void {
    if (this.state === "closed") return;
    if (this.state === "open") {
      if (Date.now() - this.openedAt >= this.cooldownMs) {
        this.state = "half_open";
        return;
      }
      throw new AppError(
        "unavailable",
        "The model is temporarily unavailable after repeated failures. Try again shortly.",
      );
    }
  }

  private succeed(): void {
    this.failures = 0;
    this.state = "closed";
  }

  private fail(): void {
    this.failures += 1;
    if (this.state === "half_open" || this.failures >= this.threshold) {
      this.state = "open";
      this.openedAt = Date.now();
    }
  }
}
