"use client";

import type { PublicSession } from "@/lib/types";
import { ProfileCard } from "./ProfileCard";

type Props = {
  session: PublicSession;
  onNew: () => void;
};

export function FrozenView({ session, onNew }: Props) {
  const ranked = session.ranked ?? session.page;

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="text-xs font-medium tracking-[0.22em] text-copper uppercase">
            Frozen · Round {session.round}
          </p>
          <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">
            This is the search.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            {session.query}
          </p>
        </div>
        <button
          type="button"
          onClick={onNew}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper-2"
        >
          New search
        </button>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section>
          <h2 className="font-serif text-2xl italic">Final filters</h2>
          <SpecSummary session={session} />
        </section>
        <section>
          <h2 className="font-serif text-2xl italic">Final rubric</h2>
          <ul className="mt-4 space-y-3">
            {session.rubric.must_haves.length > 0 ? (
              <li className="text-sm leading-6">
                <span className="text-[11px] tracking-[0.14em] text-muted uppercase">
                  Must-haves
                </span>
                <p className="mt-1">{session.rubric.must_haves.join(" · ")}</p>
              </li>
            ) : null}
            {session.rubric.criteria.map((criterion) => (
              <li key={criterion.id} className="rounded-2xl border border-line bg-paper-2 p-4">
                <p className="text-sm font-medium">
                  {criterion.name}
                  <span className="ml-2 text-xs text-muted">
                    weight {criterion.weight}
                  </span>
                </p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {criterion.description}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-2xl italic">Ranked shortlist</h2>
          <p className="text-sm text-muted">
            {ranked.length} scored · {session.filteredCount} passed filters
          </p>
        </div>
        <div className="mt-5 grid gap-4">
          {ranked.map((item, index) => (
            <ProfileCard
              key={item.profile.id}
              item={item}
              index={index}
              filters={session.filters}
              vote={null}
              frozen
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function SpecSummary({ session }: { session: PublicSession }) {
  const { filters } = session;
  const rows = [
    ["Skills", `${filters.skill_mode}: ${filters.skills.join(", ") || "any"}`],
    [
      "Years",
      filters.min_years != null || filters.max_years != null
        ? `${filters.min_years ?? "—"} – ${filters.max_years ?? "—"}`
        : "any",
    ],
    ["Locations", filters.locations.join(", ") || "any"],
    [
      "Company types",
      `${filters.company_type_scope.replace("_", " ")} · ${
        filters.company_types.join(", ") || "any"
      }`,
    ],
    ["Titles", filters.title_keywords.join(", ") || "any"],
  ];

  return (
    <dl className="mt-4 divide-y divide-line rounded-3xl border border-line bg-paper-2">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-4 px-4 py-3">
          <dt className="text-[11px] tracking-[0.14em] text-muted uppercase">
            {label}
          </dt>
          <dd className="text-sm leading-6">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
