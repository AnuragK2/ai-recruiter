export const COMPANY_TYPES = [
  "startup",
  "scaleup",
  "enterprise",
  "agency",
] as const;

export type CompanyType = (typeof COMPANY_TYPES)[number];

export type PastCompany = {
  company: string;
  company_type: CompanyType;
  title: string;
  years: number;
};

export type Profile = {
  id: string;
  name: string;
  current_title: string;
  years_experience: number;
  location: string;
  current_company: string;
  current_company_type: CompanyType;
  skills: string[];
  past_companies: PastCompany[];
  education: string;
  summary: string;
};

export type SkillMode = "any" | "all";
export type CompanyTypeScope = "current" | "any_history";

export type Filters = {
  skills: string[];
  skill_mode: SkillMode;
  min_years: number | null;
  max_years: number | null;
  locations: string[];
  company_types: CompanyType[];
  company_type_scope: CompanyTypeScope;
  title_keywords: string[];
};

export type RubricCriterion = {
  id: string;
  name: string;
  description: string;
  weight: number;
};

export type Rubric = {
  must_haves: string[];
  criteria: RubricCriterion[];
  nice_to_haves: string[];
};

export type Evidence = {
  field: string;
  quote: string;
  why: string;
};

export type RankedProfile = {
  profile: Profile;
  score: number;
  explanation: string;
  evidence: Evidence[];
};

export type SearchChange = {
  area: "filters" | "rubric";
  field: string;
  before: string;
  after: string;
  reason: string;
};

export type ChatRole = "recruiter" | "assistant" | "system";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

export type EmptyHint = {
  id: string;
  label: string;
  detail: string;
  filters: Filters;
};

export type SessionStatus = "active" | "frozen";

export type SearchSession = {
  id: string;
  createdAt: number;
  frozenAt: number | null;
  status: SessionStatus;
  query: string;
  filters: Filters;
  rubric: Rubric;
  round: number;
  messages: ChatMessage[];
  changeSummary: string | null;
  changes: SearchChange[];
  recovery: string | null;
  ranked: RankedProfile[];
  filteredCount: number;
  emptyHints: EmptyHint[];
};

export type PublicSession = {
  id: string;
  status: SessionStatus;
  query: string;
  round: number;
  filters: Filters;
  rubric: Rubric;
  messages: ChatMessage[];
  changeSummary: string | null;
  changes: SearchChange[];
  recovery: string | null;
  page: RankedProfile[];
  pageSize: number;
  totalRanked: number;
  filteredCount: number;
  poolSize: number;
  emptyHints: EmptyHint[];
  frozenAt: string | null;
  ranked: RankedProfile[] | null;
};

export type Vote = {
  profileId: string;
  match: boolean;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    retryable: boolean;
    request_id?: string;
  };
};
