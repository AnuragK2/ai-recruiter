"use client";

import { useEffect, useState } from "react";

const EXAMPLES = [
  "RDS developers with 4-7 years of experience who have worked at startups, for a role based in Bangalore.",
  "Senior React engineers in Berlin, 8+ years, comfortable coming from an agency or a product company.",
  "Database reliability engineers, remote India, who have scaled Postgres in production.",
];

type Props = {
  busy: boolean;
  error: string | null;
  onSubmit: (query: string) => void;
};

export function SearchLanding({ busy, error, onSubmit }: Props) {
  const [query, setQuery] = useState(EXAMPLES[0]);
  const [configHint, setConfigHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((response) => response.json())
      .then((data: { llmConfigured?: boolean }) => {
        if (!cancelled && !data.llmConfigured) {
          setConfigHint(
            "Add OPENAI_API_KEY, OPENAI_BASE_URL, and OPENAI_MODEL to .env.local and restart the server.",
          );
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-xs font-medium tracking-[0.22em] text-copper uppercase">
        Flexiple · Talent map
      </p>
      <h1 className="mt-5 font-serif text-5xl leading-[1.05] text-ink sm:text-6xl">
        Describe the person,
        <br />
        <span className="italic">not the job req.</span>
      </h1>
      <p className="mt-5 max-w-xl text-base leading-7 text-muted">
        One sentence becomes objective filters, a fit rubric, and a shortlist.
        You argue with the shortlist until the search is right, then freeze it.
      </p>

      <form
        className="mt-10"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(query);
        }}
      >
        <label htmlFor="brief" className="sr-only">
          Recruiter brief
        </label>
        <textarea
          id="brief"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          rows={3}
          disabled={busy}
          className="w-full resize-none rounded-2xl border border-line-strong bg-paper-2 px-5 py-4 text-[17px] leading-7 text-ink shadow-[var(--shadow)] outline-none ring-copper/30 transition focus:ring-4 disabled:opacity-60"
          placeholder="Who are you looking for?"
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy || query.trim().length < 8}
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper-2 transition hover:bg-copper disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Reading the brief…" : "Draft filters & shortlist"}
          </button>
          <p className="text-sm text-muted">48 fictional profiles. No login.</p>
        </div>
      </form>

      {configHint ? (
        <div className="mt-6 rounded-2xl border border-copper/20 bg-copper-soft px-4 py-3 text-sm leading-6 text-ink">
          {configHint}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mt-6 rounded-2xl border border-wine/20 bg-wine-soft px-4 py-3 text-sm leading-6 text-wine"
        >
          {error}
        </div>
      ) : null}

      <div className="mt-10">
        <p className="text-xs tracking-[0.18em] text-muted uppercase">Try a brief</p>
        <div className="mt-3 flex flex-col gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              disabled={busy}
              onClick={() => setQuery(example)}
              className="rounded-xl border border-transparent px-3 py-2 text-left text-sm leading-6 text-muted transition hover:border-line hover:bg-paper-2 hover:text-ink"
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
