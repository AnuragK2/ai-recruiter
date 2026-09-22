"use client";

import { skillMatches } from "@/lib/filter";
import type { Filters, RankedProfile } from "@/lib/types";

type VoteState = boolean | null;

type Props = {
  item: RankedProfile;
  index: number;
  filters: Filters;
  vote: VoteState;
  disabled?: boolean;
  frozen?: boolean;
  onVote?: (match: boolean) => void;
};

export function ProfileCard({
  item,
  index,
  filters,
  vote,
  disabled,
  frozen,
  onVote,
}: Props) {
  const { profile, score, explanation, evidence } = item;

  return (
    <article
      className={`rounded-3xl border bg-paper-2 p-5 shadow-[var(--shadow)] transition ${
        vote === true
          ? "border-forest/40"
          : vote === false
            ? "border-wine/40"
            : "border-line"
      }`}
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] tracking-[0.18em] text-muted uppercase">
            {index + 1}
          </p>
          <h3 className="mt-1 font-serif text-[1.65rem] leading-none">
            {profile.name}
          </h3>
          <p className="mt-2 text-sm text-ink">
            {profile.current_title} · {profile.current_company}
            <span className="text-muted"> · {profile.current_company_type}</span>
          </p>
          <p className="mt-1 text-sm text-muted">
            {profile.location} · {profile.years_experience} years ·{" "}
            {profile.education}
          </p>
        </div>
        <div className="text-right">
          <p className="tabular font-serif text-3xl leading-none">{score}</p>
          <p className="mt-1 text-[11px] tracking-[0.16em] text-muted uppercase">
            Fit
          </p>
        </div>
      </header>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {profile.skills.map((skill) => {
          const hit = filters.skills.some((required) =>
            skillMatches(skill, required),
          );
          return (
            <span
              key={skill}
              className={`rounded-full px-2.5 py-1 text-[11px] ${
                hit ? "bg-copper-soft text-copper" : "bg-ink/5 text-muted"
              }`}
            >
              {skill}
            </span>
          );
        })}
      </div>

      <p className="mt-4 text-sm leading-6 text-ink">{explanation}</p>

      <ul className="mt-3 space-y-1.5">
        {evidence.map((itemEvidence) => (
          <li
            key={`${itemEvidence.field}-${itemEvidence.quote}`}
            className="text-xs leading-5 text-muted"
          >
            <span className="font-medium text-ink">{itemEvidence.field}</span>
            {" · "}
            <span className="italic">“{itemEvidence.quote}”</span>
            {" — "}
            {itemEvidence.why}
          </li>
        ))}
      </ul>

      {!frozen && onVote ? (
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onVote(false)}
            className={`flex-1 rounded-full px-3 py-2 text-sm ${
              vote === false
                ? "bg-wine text-paper-2"
                : "border border-line bg-paper text-muted"
            }`}
          >
            Not a match
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onVote(true)}
            className={`flex-1 rounded-full px-3 py-2 text-sm ${
              vote === true
                ? "bg-forest text-paper-2"
                : "border border-line bg-paper text-muted"
            }`}
          >
            Match
          </button>
        </div>
      ) : null}
    </article>
  );
}
