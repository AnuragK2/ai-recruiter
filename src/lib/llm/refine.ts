import { formatFilters, formatRubric } from "../diff";
import { wrapUntrusted } from "../sanitize";
import { refineResultSchema } from "../schemas";
import type { Filters, RankedProfile, Rubric, Vote } from "../types";
import { structuredLlm } from "@/server/llm/client";
import { refineJsonSchema } from "./json-schemas";
import { REFINE_SYSTEM } from "./prompts";

function shownBlock(page: RankedProfile[]): string {
  return page
    .map((item, index) => {
      const p = item.profile;
      return [
        `${index + 1}. ${p.id} — ${p.name}`,
        `title: ${p.current_title} @ ${p.current_company} (${p.current_company_type})`,
        `years_experience: ${p.years_experience}; location: ${p.location}`,
        `skills: ${p.skills.join(", ")}`,
        `summary: ${p.summary}`,
        `score: ${item.score}; explanation: ${item.explanation}`,
      ].join("\n");
    })
    .join("\n\n");
}

export async function refineSpec(input: {
  query: string;
  filters: Filters;
  rubric: Rubric;
  page: RankedProfile[];
  votes: Vote[];
  message: string;
}) {
  const voteLines =
    input.votes.length === 0
      ? "none"
      : input.votes
          .map((vote) => {
            const ranked = input.page.find((item) => item.profile.id === vote.profileId);
            const n = ranked
              ? input.page.findIndex((item) => item.profile.id === vote.profileId) + 1
              : "?";
            return `${vote.profileId} (shown as #${n}): ${vote.match ? "MATCH" : "NOT A MATCH"}`;
          })
          .join("\n");

  const user = [
    wrapUntrusted("original_search", input.query),
    "Current filters:\n" + formatFilters(input.filters),
    "Current rubric:\n" + formatRubric(input.rubric),
    "Numbered profiles the recruiter is looking at:\n" + shownBlock(input.page),
    "Per-profile votes:\n" + voteLines,
    wrapUntrusted("recruiter_message", input.message || "(no free-text message)"),
    "Update filters and rubric. Map numbers in the recruiter message to the numbered list above.",
  ].join("\n\n");

  return structuredLlm({
    system: REFINE_SYSTEM,
    user,
    schema: refineJsonSchema,
    schemaName: "refined_search",
    validator: refineResultSchema,
  });
}
