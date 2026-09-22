import { handle } from "@/server/http/handler";
import { sessionController } from "@/server/container";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle({ rateLimit: "read" }, (ctx) => sessionController.freeze(ctx));
