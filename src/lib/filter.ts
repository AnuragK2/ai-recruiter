import type { EmptyHint, Filters, Profile } from "./types";

const LOCATION_GROUPS: Record<string, string[]> = {
  bangalore: ["bangalore", "bengaluru"],
  bengaluru: ["bangalore", "bengaluru"],
  "delhi ncr": ["delhi ncr", "delhi", "gurgaon", "gurugram", "noida"],
  delhi: ["delhi ncr", "delhi", "gurgaon", "gurugram", "noida"],
  "remote - india": ["remote - india", "remote", "india remote", "remote india"],
  remote: ["remote - india", "remote", "india remote", "remote india"],
};

const SKILL_ALIASES: Record<string, string[]> = {
  rds: ["rds", "awsrds", "amazonrds"],
  awsrds: ["rds", "awsrds", "amazonrds"],
  amazonrds: ["rds", "awsrds", "amazonrds"],
  node: ["node", "nodejs"],
  nodejs: ["node", "nodejs"],
  react: ["react", "reactjs"],
  reactjs: ["react", "reactjs"],
  postgres: ["postgres", "postgresql"],
  postgresql: ["postgres", "postgresql"],
  k8s: ["k8s", "kubernetes"],
  kubernetes: ["k8s", "kubernetes"],
  ts: ["ts", "typescript"],
  typescript: ["ts", "typescript"],
  golang: ["go", "golang"],
  go: ["go", "golang"],
  js: ["js", "javascript"],
  javascript: ["js", "javascript"],
  nextjs: ["nextjs", "next"],
  next: ["nextjs", "next"],
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#]/g, "");
}

function normalizeSpace(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function expandSkill(value: string): Set<string> {
  const token = normalize(value);
  const aliases = SKILL_ALIASES[token] ?? [token];
  return new Set(aliases);
}

export function skillMatches(profileSkill: string, required: string): boolean {
  const have = expandSkill(profileSkill);
  const need = expandSkill(required);
  for (const token of need) {
    if (have.has(token)) return true;
  }

  const profileNorm = normalize(profileSkill);
  const requiredNorm = normalize(required);
  if (!profileNorm || !requiredNorm) return false;
  if (profileNorm === requiredNorm) return true;

  // Avoid "rds" matching "redis". Only allow contains for longer names.
  if (requiredNorm.length >= 5 && profileNorm.includes(requiredNorm)) return true;
  if (profileNorm.length >= 5 && requiredNorm.includes(profileNorm)) return true;
  return false;
}

function profileHasSkill(profile: Profile, required: string): boolean {
  return profile.skills.some((skill) => skillMatches(skill, required));
}

function locationMatches(profileLocation: string, required: string): boolean {
  const have = normalizeSpace(profileLocation);
  const need = normalizeSpace(required);
  if (have === need) return true;
  const haveGroup = LOCATION_GROUPS[have] ?? [have];
  const needGroup = LOCATION_GROUPS[need] ?? [need];
  return haveGroup.some((item) => needGroup.includes(item));
}

function titleMatches(title: string, keyword: string): boolean {
  return normalizeSpace(title).includes(normalizeSpace(keyword));
}

function companyTypeMatches(profile: Profile, filters: Filters): boolean {
  if (filters.company_types.length === 0) return true;
  if (filters.company_types.includes(profile.current_company_type)) return true;
  if (filters.company_type_scope === "any_history") {
    return profile.past_companies.some((past) =>
      filters.company_types.includes(past.company_type),
    );
  }
  return false;
}

export function matchesFilters(profile: Profile, filters: Filters): boolean {
  if (filters.min_years != null && profile.years_experience < filters.min_years) {
    return false;
  }
  if (filters.max_years != null && profile.years_experience > filters.max_years) {
    return false;
  }

  if (filters.locations.length > 0) {
    const ok = filters.locations.some((location) =>
      locationMatches(profile.location, location),
    );
    if (!ok) return false;
  }

  if (!companyTypeMatches(profile, filters)) return false;

  if (filters.title_keywords.length > 0) {
    const ok = filters.title_keywords.some((keyword) =>
      titleMatches(profile.current_title, keyword),
    );
    if (!ok) return false;
  }

  if (filters.skills.length > 0) {
    if (filters.skill_mode === "all") {
      if (!filters.skills.every((skill) => profileHasSkill(profile, skill))) {
        return false;
      }
    } else if (!filters.skills.some((skill) => profileHasSkill(profile, skill))) {
      return false;
    }
  }

  return true;
}

export function applyFilters(profiles: Profile[], filters: Filters): Profile[] {
  return profiles.filter((profile) => matchesFilters(profile, filters));
}

function skillOverlapCount(profile: Profile, skills: string[]): number {
  if (skills.length === 0) return 0;
  return skills.filter((skill) => profileHasSkill(profile, skill)).length;
}

export function heuristicRank(profiles: Profile[], filters: Filters): Profile[] {
  return [...profiles].sort((a, b) => {
    const score = (profile: Profile) => {
      let value = skillOverlapCount(profile, filters.skills) * 8;
      if (filters.locations.some((location) => locationMatches(profile.location, location))) {
        value += 4;
      }
      if (filters.company_types.includes(profile.current_company_type)) value += 3;
      if (
        filters.title_keywords.some((keyword) =>
          titleMatches(profile.current_title, keyword),
        )
      ) {
        value += 2;
      }
      if (filters.min_years != null && filters.max_years != null) {
        const mid = (filters.min_years + filters.max_years) / 2;
        value -= Math.abs(profile.years_experience - mid);
      }
      return value;
    };
    return score(b) - score(a);
  });
}

export function emptyHints(filters: Filters, profiles: Profile[]): EmptyHint[] {
  const hints: EmptyHint[] = [];

  if (filters.skill_mode === "all" && filters.skills.length > 1) {
    const next = { ...filters, skill_mode: "any" as const };
    hints.push({
      id: "skills-any",
      label: "Match any listed skill",
      detail: "Require one of the skills instead of all of them.",
      filters: next,
    });
  }

  if (filters.locations.length > 0) {
    const next = { ...filters, locations: [] };
    hints.push({
      id: "drop-location",
      label: "Drop the location constraint",
      detail: "Search the full talent map regardless of city.",
      filters: next,
    });
  }

  if (filters.company_types.length > 0) {
    const next = {
      ...filters,
      company_type_scope: "any_history" as const,
      company_types:
        filters.company_type_scope === "current"
          ? filters.company_types
          : [],
    };
    hints.push({
      id: "relax-company",
      label:
        filters.company_type_scope === "current"
          ? "Count past company types too"
          : "Drop company-type filter",
      detail: "Company background often belongs in the rubric, not a hard filter.",
      filters: next,
    });
  }

  if (filters.min_years != null || filters.max_years != null) {
    const next = { ...filters, min_years: null, max_years: null };
    hints.push({
      id: "drop-years",
      label: "Drop the years-of-experience band",
      detail: "Let the rubric judge seniority instead of a hard range.",
      filters: next,
    });
  }

  return hints.filter((hint) => applyFilters(profiles, hint.filters).length > 0);
}
