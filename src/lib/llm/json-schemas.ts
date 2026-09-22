export const generateJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["filters", "rubric"],
  properties: {
    filters: {
      type: "object",
      additionalProperties: false,
      required: [
        "skills",
        "skill_mode",
        "min_years",
        "max_years",
        "locations",
        "company_types",
        "company_type_scope",
        "title_keywords",
      ],
      properties: {
        skills: { type: "array", items: { type: "string" } },
        skill_mode: { type: "string", enum: ["any", "all"] },
        min_years: { type: ["integer", "null"] },
        max_years: { type: ["integer", "null"] },
        locations: { type: "array", items: { type: "string" } },
        company_types: {
          type: "array",
          items: {
            type: "string",
            enum: ["startup", "scaleup", "enterprise", "agency"],
          },
        },
        company_type_scope: {
          type: "string",
          enum: ["current", "any_history"],
        },
        title_keywords: { type: "array", items: { type: "string" } },
      },
    },
    rubric: {
      type: "object",
      additionalProperties: false,
      required: ["must_haves", "criteria", "nice_to_haves"],
      properties: {
        must_haves: { type: "array", items: { type: "string" } },
        criteria: {
          type: "array",
          minItems: 2,
          maxItems: 6,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "name", "description", "weight"],
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              description: { type: "string" },
              weight: { type: "integer", minimum: 1, maximum: 5 },
            },
          },
        },
        nice_to_haves: { type: "array", items: { type: "string" } },
      },
    },
  },
} as const;

export const scoreJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["scores"],
  properties: {
    scores: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["profile_id", "score", "explanation", "evidence"],
        properties: {
          profile_id: { type: "string" },
          score: { type: "integer", minimum: 0, maximum: 100 },
          explanation: { type: "string" },
          evidence: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["field", "quote", "why"],
              properties: {
                field: { type: "string" },
                quote: { type: "string" },
                why: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
} as const;

export const refineJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["filters", "rubric", "change_summary", "changes"],
  properties: {
    ...generateJsonSchema.properties,
    change_summary: { type: "string" },
    changes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["area", "field", "before", "after", "reason"],
        properties: {
          area: { type: "string", enum: ["filters", "rubric"] },
          field: { type: "string" },
          before: { type: "string" },
          after: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
  },
} as const;
