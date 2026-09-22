import type { Profile, Rubric } from "../types";
import { wrapUntrusted } from "../sanitize";
import { scoreResultSchema } from "../schemas";
import { structuredLlm } from "@/server/llm/client";
import { scoreJsonSchema } from "./json-schemas";
import { SCORE_SYSTEM } from "./prompts";

function compact(profile: Profile) {
  return {
    id: profile.id,
    name: profile.name,
    current_title: profile.current_title,
    years_experience: profile.years_experience,
    location: profile.location,
    current_company: profile.current_company,
    current_company_type: profile.current_company_type,
    skills: profile.skills,
    past_companies: profile.past_companies,
    education: profile.education,
    summary: profile.summary,
  };
}

export async function scoreProfiles(input: {
  query: string;
  rubric: Rubric;
  profiles: Profile[];
}) {
  const user = [
    wrapUntrusted("recruiter_search", input.query),
    wrapUntrusted("rubric_json", JSON.stringify(input.rubric)),
    wrapUntrusted("profiles_json", JSON.stringify(input.profiles.map(compact))),
    "Score every profile in profiles_json. Cite only fields present in that object.",
  ].join("\n\n");

  return structuredLlm({
    system: SCORE_SYSTEM,
    user,
    schema: scoreJsonSchema,
    schemaName: "profile_scores",
    validator: scoreResultSchema,
  });
}
