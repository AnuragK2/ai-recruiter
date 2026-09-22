"use client";

import type { ReactNode } from "react";
import { COMPANY_TYPES, type Filters, type Rubric } from "@/lib/types";
import { TagInput } from "./TagInput";

type Props = {
  filters: Filters;
  rubric: Rubric;
  disabled?: boolean;
  dirty: boolean;
  onFilters: (filters: Filters) => void;
  onRubric: (rubric: Rubric) => void;
  onApply: () => void;
};

export function SpecPanel({
  filters,
  rubric,
  disabled,
  dirty,
  onFilters,
  onRubric,
  onApply,
}: Props) {
  return (
    <aside className="flex h-full flex-col gap-6 overflow-y-auto pr-1">
      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-2xl italic">Filters</h2>
          <span className="text-[11px] tracking-[0.16em] text-muted uppercase">
            Objective
          </span>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted">
          Hard constraints applied locally to the talent map. Edit and apply
          without another parse.
        </p>

        <Field label="Skills">
          <TagInput
            values={filters.skills}
            disabled={disabled}
            placeholder="Add a skill"
            onChange={(skills) => onFilters({ ...filters, skills })}
          />
          <div className="mt-2 flex gap-2">
            {(["any", "all"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                disabled={disabled}
                onClick={() => onFilters({ ...filters, skill_mode: mode })}
                className={`rounded-full px-3 py-1 text-[11px] ${
                  filters.skill_mode === mode
                    ? "bg-ink text-paper-2"
                    : "bg-ink/5 text-muted"
                }`}
              >
                Match {mode}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Years of experience">
          <div className="flex items-center gap-2">
            <NumberBox
              value={filters.min_years}
              disabled={disabled}
              placeholder="Min"
              onChange={(min_years) => onFilters({ ...filters, min_years })}
            />
            <span className="text-xs text-muted">to</span>
            <NumberBox
              value={filters.max_years}
              disabled={disabled}
              placeholder="Max"
              onChange={(max_years) => onFilters({ ...filters, max_years })}
            />
          </div>
        </Field>

        <Field label="Locations">
          <TagInput
            values={filters.locations}
            disabled={disabled}
            placeholder="Add a city"
            onChange={(locations) => onFilters({ ...filters, locations })}
          />
        </Field>

        <Field label="Company background">
          <div className="flex flex-wrap gap-1.5">
            {COMPANY_TYPES.map((type) => {
              const on = filters.company_types.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    const company_types = on
                      ? filters.company_types.filter((item) => item !== type)
                      : [...filters.company_types, type];
                    onFilters({ ...filters, company_types });
                  }}
                  className={`rounded-full px-3 py-1 text-[11px] capitalize ${
                    on ? "bg-copper text-paper-2" : "bg-ink/5 text-muted"
                  }`}
                >
                  {type}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex gap-2">
            {(["any_history", "current"] as const).map((scope) => (
              <button
                key={scope}
                type="button"
                disabled={disabled}
                onClick={() => onFilters({ ...filters, company_type_scope: scope })}
                className={`rounded-full px-3 py-1 text-[11px] ${
                  filters.company_type_scope === scope
                    ? "bg-ink text-paper-2"
                    : "bg-ink/5 text-muted"
                }`}
              >
                {scope === "any_history" ? "Current or past" : "Current only"}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Title keywords">
          <TagInput
            values={filters.title_keywords}
            disabled={disabled}
            placeholder="backend, database…"
            onChange={(title_keywords) => onFilters({ ...filters, title_keywords })}
          />
        </Field>
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-2xl italic">Rubric</h2>
          <span className="text-[11px] tracking-[0.16em] text-muted uppercase">
            Subjective
          </span>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted">
          What good looks like. Used only after someone survives the filters.
        </p>

        <Field label="Must-haves">
          <TagInput
            values={rubric.must_haves}
            disabled={disabled}
            placeholder="Add a qualitative bar"
            onChange={(must_haves) => onRubric({ ...rubric, must_haves })}
          />
        </Field>

        <div className="mt-3 space-y-3">
          {rubric.criteria.map((criterion, index) => (
            <div
              key={criterion.id}
              className="rounded-2xl border border-line bg-paper-2 p-3"
            >
              <div className="flex items-center gap-2">
                <input
                  value={criterion.name}
                  disabled={disabled}
                  onChange={(event) => {
                    const criteria = rubric.criteria.map((item, i) =>
                      i === index ? { ...item, name: event.target.value } : item,
                    );
                    onRubric({ ...rubric, criteria });
                  }}
                  className="flex-1 bg-transparent text-sm font-medium outline-none"
                />
                <label className="flex items-center gap-1 text-[11px] text-muted">
                  w
                  <input
                    type="number"
                    min={1}
                    max={5}
                    disabled={disabled}
                    value={criterion.weight}
                    onChange={(event) => {
                      const weight = Math.min(
                        5,
                        Math.max(1, Number(event.target.value) || 1),
                      );
                      const criteria = rubric.criteria.map((item, i) =>
                        i === index ? { ...item, weight } : item,
                      );
                      onRubric({ ...rubric, criteria });
                    }}
                    className="w-10 rounded-md border border-line bg-paper px-1 py-0.5 text-center text-xs"
                  />
                </label>
              </div>
              <textarea
                value={criterion.description}
                disabled={disabled}
                rows={2}
                onChange={(event) => {
                  const criteria = rubric.criteria.map((item, i) =>
                    i === index
                      ? { ...item, description: event.target.value }
                      : item,
                  );
                  onRubric({ ...rubric, criteria });
                }}
                className="mt-2 w-full resize-none bg-transparent text-xs leading-5 text-muted outline-none"
              />
            </div>
          ))}
        </div>

        <Field label="Nice-to-haves">
          <TagInput
            values={rubric.nice_to_haves}
            disabled={disabled}
            placeholder="Optional flavour"
            onChange={(nice_to_haves) => onRubric({ ...rubric, nice_to_haves })}
          />
        </Field>
      </section>

      {dirty ? (
        <button
          type="button"
          onClick={onApply}
          disabled={disabled}
          className="sticky bottom-0 rounded-full bg-copper px-4 py-2.5 text-sm font-medium text-paper-2"
        >
          Apply edits and re-run
        </button>
      ) : null}
    </aside>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-4">
      <p className="mb-1.5 text-[11px] tracking-[0.14em] text-muted uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}

function NumberBox({
  value,
  placeholder,
  disabled,
  onChange,
}: {
  value: number | null;
  placeholder: string;
  disabled?: boolean;
  onChange: (value: number | null) => void;
}) {
  return (
    <input
      type="number"
      min={0}
      max={40}
      disabled={disabled}
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(event) => {
        const raw = event.target.value;
        onChange(raw === "" ? null : Number(raw));
      }}
      className="w-20 rounded-xl border border-line bg-paper-2 px-3 py-2 text-sm outline-none"
    />
  );
}
