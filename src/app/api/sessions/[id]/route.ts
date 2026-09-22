import { handle } from "@/server/http/handler";
import { sessionController } from "@/server/container";
import { patchSessionBodySchema } from "@/server/controllers/session.controller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = handle({ rateLimit: "read" }, (ctx) => sessionController.show(ctx));

export const PATCH = handle(
  { rateLimit: "llm", body: patchSessionBodySchema },
  (ctx) => sessionController.update(ctx),
);
