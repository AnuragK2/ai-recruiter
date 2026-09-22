import { z } from "zod";
import { COMPANY_TYPES } from "./types";

const nonEmpty = z.string().trim().min(1);

function stringList(maxItems: number, maxLen: number) {
  return z.preprocess((value) => {
    if (value == null) return [];
    if (Array.isArray(value)) {
      return value
        .map((item) => String(item).trim())
        .filter(Boolean)
        .slice(0, maxItems)
        .map((item) => item.slice(0, maxLen));
    }
    if (typeof value === "string") {
      return value
        .split(/,|\n/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, maxItems);
    }
    return [];
  }, z.array(nonEmpty.max(maxLen)).max(maxItems));
}

const companyType = z.enum(COMPANY_TYPES);

export const filtersSchema = z.object({
  skills: stringList(16, 48),
  skill_mode: z.enum(["any", "all"]).default("any"),
  min_years: z.preprocess((v) => {
    if (v === "" || v === undefined || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  }, z.number().int().min(0).max(40).nullable()),
  max_years: z.preprocess((v) => {
    if (v === "" || v === undefined || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  }, z.number().int().min(0).max(40).nullable()),
  locations: stringList(12, 48),
  company_types: z.preprocess((value) => {
    if (!Array.isArray(value)) return [];
    return value.filter((item) =>
      (COMPANY_TYPES as readonly string[]).includes(String(item)),
    );
  }, z.array(companyType).max(4)),
  company_type_scope: z.enum(["current", "any_history"]).default("any_history"),
  title_keywords: stringList(10, 40),
});

export const rubricSchema = z.object({
  must_haves: stringList(6, 160),
  criteria: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(40),
        name: z.string().trim().min(1).max(80),
        description: z.string().trim().min(1).max(400),
        weight: z.coerce.number().int().min(1).max(5),
      }),
    )
    .min(2)
    .max(6),
  nice_to_haves: stringList(6, 160),
});

export const generateResultSchema = z.object({
  filters: filtersSchema,
  rubric: rubricSchema,
});

export const evidenceSchema = z.object({
  field: z.string().trim().min(1).max(64),
  quote: z.string().trim().min(1).max(240),
  why: z.string().trim().min(1).max(240),
});

export const scoreItemSchema = z.object({
  profile_id: z.string().trim().min(1).max(16),
  score: z.coerce.number().min(0).max(100),
  explanation: z.string().trim().min(1).max(600),
  evidence: z.array(evidenceSchema).min(1).max(5),
});

export const scoreResultSchema = z.object({
  scores: z.array(scoreItemSchema).min(1).max(24),
});

export const changeSchema = z.object({
  area: z.enum(["filters", "rubric"]),
  field: z.string().trim().min(1).max(80),
  before: z.string().trim().max(240).default(""),
  after: z.string().trim().max(240).default(""),
  reason: z.string().trim().min(1).max(280),
});

export const refineResultSchema = z.object({
  filters: filtersSchema,
  rubric: rubricSchema,
  change_summary: z.string().trim().min(1).max(600),
  changes: z.array(changeSchema).max(8).default([]),
});

export const createSessionBodySchema = z.object({
  query: z
    .string()
    .trim()
    .min(8, "Describe the role in a bit more detail.")
    .max(800, "Keep the brief under 800 characters."),
});

export const patchSessionBodySchema = z.object({
  filters: filtersSchema,
  rubric: rubricSchema,
});

export const refineBodySchema = z
  .object({
    message: z.string().trim().max(1000).optional().default(""),
    votes: z
      .array(
        z.object({
          profileId: z.string().trim().min(1).max(16),
          match: z.boolean(),
        }),
      )
      .max(8)
      .optional()
      .default([]),
  })
  .superRefine((value, ctx) => {
    if (!value.message && value.votes.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Tell us in chat, or mark at least one profile yes/no.",
      });
    }
  });

export type GenerateResult = z.infer<typeof generateResultSchema>;
export type ScoreResult = z.infer<typeof scoreResultSchema>;
export type RefineResult = z.infer<typeof refineResultSchema>;
