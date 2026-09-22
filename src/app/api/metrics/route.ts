import { handle } from "@/server/http/handler";
import { healthController } from "@/server/container";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle({ rateLimit: "read", allowDuringShutdown: true }, async () =>
  healthController.metrics(),
);
