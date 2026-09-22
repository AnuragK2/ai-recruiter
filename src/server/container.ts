import { logger } from "./logger";
import { HealthController } from "./controllers/health.controller";
import { SessionController } from "./controllers/session.controller";
import { ProfileRepository } from "./repositories/profile.repository";
import { SessionRepository } from "./repositories/session.repository";
import { FilterService } from "./services/filter.service";
import { LlmService } from "./services/llm.service";
import { SearchService } from "./services/search.service";
import { getConfig } from "./config";
import { registerShutdownHooks } from "./shutdown";

const profileRepository = new ProfileRepository();
const sessionRepository = new SessionRepository();
const filterService = new FilterService(profileRepository);
const llmService = new LlmService();
const searchService = new SearchService(
  sessionRepository,
  profileRepository,
  filterService,
  llmService,
);

export const sessionController = new SessionController(searchService);
export const healthController = new HealthController(
  profileRepository,
  sessionRepository,
  llmService,
);

let booted = false;

export function boot(): void {
  if (booted) return;
  booted = true;
  const config = getConfig();
  registerShutdownHooks();
  profileRepository.load();
  logger.info({
    msg: "runtime.boot",
    env: config.NODE_ENV,
    llm: Boolean(config.OPENAI_API_KEY && config.OPENAI_MODEL),
  });
}
