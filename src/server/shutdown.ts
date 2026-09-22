import { getConfig } from "./config";
import { logger } from "./logger";
import { metrics } from "./metrics";

let shuttingDown = false;
let hooksRegistered = false;

export function isShuttingDown(): boolean {
  return shuttingDown;
}

export function beginShutdown(): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.warn({ msg: "shutdown.begin", inFlight: metrics.inFlight() });
}

async function drain(): Promise<void> {
  const timeout = getConfig().SHUTDOWN_DRAIN_MS;
  const start = Date.now();
  while (metrics.inFlight() > 0 && Date.now() - start < timeout) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  logger.info({
    msg: "shutdown.drained",
    remaining: metrics.inFlight(),
    waitedMs: Date.now() - start,
  });
}

export function registerShutdownHooks(): void {
  if (hooksRegistered) return;
  hooksRegistered = true;

  const onSignal = (signal: string) => {
    if (shuttingDown) return;
    logger.warn({ msg: "shutdown.signal", signal });
    beginShutdown();
    void drain();
  };

  process.once("SIGTERM", () => onSignal("SIGTERM"));
  if (getConfig().NODE_ENV === "production") {
    process.once("SIGINT", () => onSignal("SIGINT"));
  }
}
