import { z } from "zod";
import {
  createSessionBodySchema,
  patchSessionBodySchema,
  refineBodySchema,
} from "@/lib/schemas";
import type { ApiContext, ApiResult } from "../http/handler";
import type { SearchService } from "../services/search.service";

const idSchema = z.string().uuid("Session id is invalid.");

export class SessionController {
  constructor(private readonly search: SearchService) {}

  async create(ctx: ApiContext<z.infer<typeof createSessionBodySchema>>): Promise<ApiResult> {
    const session = await this.search.start(
      ctx.body.query,
      ctx.request.headers.get("idempotency-key"),
    );
    return { status: 201, body: { session } };
  }

  async show(ctx: ApiContext<undefined>): Promise<ApiResult> {
    const id = idSchema.parse(ctx.params.id);
    return { body: { session: this.search.get(id) } };
  }

  async update(ctx: ApiContext<z.infer<typeof patchSessionBodySchema>>): Promise<ApiResult> {
    const id = idSchema.parse(ctx.params.id);
    const session = await this.search.applyEdits(id, ctx.body.filters, ctx.body.rubric);
    return { body: { session } };
  }

  async refine(ctx: ApiContext<z.infer<typeof refineBodySchema>>): Promise<ApiResult> {
    const id = idSchema.parse(ctx.params.id);
    const session = await this.search.refine(id, {
      message: ctx.body.message ?? "",
      votes: ctx.body.votes ?? [],
    });
    return { body: { session } };
  }

  async freeze(ctx: ApiContext<undefined>): Promise<ApiResult> {
    const id = idSchema.parse(ctx.params.id);
    const session = await this.search.freeze(id);
    return { body: { session } };
  }
}

export { createSessionBodySchema, patchSessionBodySchema, refineBodySchema };
