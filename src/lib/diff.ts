import type { Filters, Rubric, SearchChange } from "./types";

function fmtList(values: string[]): string {
  return values.length ? values.join(", ") : "any";
}

function yearsLabel(filters: Filters): string {
  if (filters.min_years == null && filters.max_years == null) return "any";
  if (filters.min_years != null && filters.max_years != null) {
    return `${filters.min_years}–${filters.max_years}`;
  }
  if (filters.min_years != null) return `${filters.min_years}+`;
  return `up to ${filters.max_years}`;
}

export function diffSearch(
  beforeFilters: Filters,
  afterFilters: Filters,
  beforeRubric: Rubric,
  afterRubric: Rubric,
  reasonFallback: string,
): SearchChange[] {
  const changes: SearchChange[] = [];

  const push = (
    area: "filters" | "rubric",
    field: string,
    before: string,
    after: string,
  ) => {
    if (before === after) return;
    changes.push({
      area,
      field,
      before,
      after,
      reason: reasonFallback,
    });
  };

  push("filters", "skills", fmtList(beforeFilters.skills), fmtList(afterFilters.skills));
  push("filters", "skill_mode", beforeFilters.skill_mode, afterFilters.skill_mode);
  push("filters", "years", yearsLabel(beforeFilters), yearsLabel(afterFilters));
  push(
    "filters",
    "locations",
    fmtList(beforeFilters.locations),
    fmtList(afterFilters.locations),
  );
  push(
    "filters",
    "company_types",
    fmtList(beforeFilters.company_types),
    fmtList(afterFilters.company_types),
  );
  push(
    "filters",
    "company_type_scope",
    beforeFilters.company_type_scope,
    afterFilters.company_type_scope,
  );
  push(
    "filters",
    "title_keywords",
    fmtList(beforeFilters.title_keywords),
    fmtList(afterFilters.title_keywords),
  );

  push(
    "rubric",
    "must_haves",
    fmtList(beforeRubric.must_haves),
    fmtList(afterRubric.must_haves),
  );
  push(
    "rubric",
    "nice_to_haves",
    fmtList(beforeRubric.nice_to_haves),
    fmtList(afterRubric.nice_to_haves),
  );

  const beforeCriteria = beforeRubric.criteria
    .map((c) => `${c.name} (${c.weight}): ${c.description}`)
    .join(" | ");
  const afterCriteria = afterRubric.criteria
    .map((c) => `${c.name} (${c.weight}): ${c.description}`)
    .join(" | ");
  push("rubric", "criteria", beforeCriteria, afterCriteria);

  return changes;
}

export function formatFilters(filters: Filters): string {
  const lines = [
    `Skills (${filters.skill_mode}): ${fmtList(filters.skills)}`,
    `Years: ${yearsLabel(filters)}`,
    `Locations: ${fmtList(filters.locations)}`,
    `Company types (${filters.company_type_scope}): ${fmtList(filters.company_types)}`,
    `Title keywords: ${fmtList(filters.title_keywords)}`,
  ];
  return lines.join("\n");
}

export function formatRubric(rubric: Rubric): string {
  const criteria = rubric.criteria
    .map((c) => `- ${c.name} [weight ${c.weight}]: ${c.description}`)
    .join("\n");
  return [
    `Must-haves: ${fmtList(rubric.must_haves)}`,
    `Criteria:\n${criteria}`,
    `Nice-to-haves: ${fmtList(rubric.nice_to_haves)}`,
  ].join("\n");
}
