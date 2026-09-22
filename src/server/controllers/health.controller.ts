import { getConfig, llmReady } from "../config";
import type { ApiResult } from "../http/handler";
import { metrics } from "../metrics";
import { isShuttingDown } from "../shutdown";
import type { LlmService } from "../services/llm.service";
import type { ProfileRepository } from "../repositories/profile.repository";
import type { SessionRepository } from "../repositories/session.repository";

export class HealthController {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly sessions: SessionRepository,
    private readonly llm: LlmService,
  ) {}

  live(): ApiResult {
    return {
      body: {
        ok: true,
        status: "ok",
        llmConfigured: llmReady(),
      },
    };
  }

  ready(): ApiResult {
    const ready =
      !isShuttingDown() &&
      llmReady() &&
      this.llm.circuit.snapshot.state !== "open";
    return {
      status: ready ? 200 : 503,
      body: {
        status: ready ? "ready" : "not_ready",
        shuttingDown: isShuttingDown(),
        llmConfigured: llmReady(),
        circuit: this.llm.circuit.snapshot.state,
      },
    };
  }

  metrics(): ApiResult {
    return {
      body: metrics.snapshot({
        sessions: this.sessions.size,
        profiles: this.profiles.size,
        circuit: this.llm.circuit.snapshot,
        jobs: this.llm.queue.snapshot,
        model: getConfig().OPENAI_MODEL ? "configured" : "missing",
      }),
    };
  }
}
