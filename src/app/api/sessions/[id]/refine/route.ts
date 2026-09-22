import { handle } from "@/server/http/handler";
import { sessionController } from "@/server/container";
import { refineBodySchema } from "@/server/controllers/session.controller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = handle(
  { rateLimit: "llm", body: refineBodySchema },
  (ctx) => sessionController.refine(ctx),
);
