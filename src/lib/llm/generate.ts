import { wrapUntrusted } from "../sanitize";
import { generateResultSchema } from "../schemas";
import { structuredLlm } from "@/server/llm/client";
import { generateJsonSchema } from "./json-schemas";
import { PARSE_SYSTEM } from "./prompts";

export async function generateSpec(query: string) {
  const user = [
    "Convert this recruiter search into filters and a rubric.",
    "Known company_type values: startup, scaleup, enterprise, agency.",
    "Locations that exist in this talent map: Bangalore, Mumbai, Hyderabad, Chennai, Delhi NCR, Pune, Remote - India, Berlin, Amsterdam.",
    wrapUntrusted("recruiter_search", query),
  ].join("\n\n");

  return structuredLlm({
    system: PARSE_SYSTEM,
    user,
    schema: generateJsonSchema,
    schemaName: "filters_and_rubric",
    validator: generateResultSchema,
  });
}
