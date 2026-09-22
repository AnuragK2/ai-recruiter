"use client";

import type {
  EmptyHint,
  Filters,
  PublicSession,
  Rubric,
  SearchChange,
} from "@/lib/types";
import { ChatPanel } from "./ChatPanel";
import { EmptyResults } from "./EmptyResults";
import { ProfileCard } from "./ProfileCard";
import { SpecPanel } from "./SpecPanel";
import { ThinkingSteps } from "./ThinkingSteps";

type VoteMap = Record<string, boolean>;

type Props = {
  session: PublicSession;
  filters: Filters;
  rubric: Rubric;
  votes: VoteMap;
  dirty: boolean;
  busy: boolean;
  thinkingMode: "search" | "refine" | "edit" | null;
  error: string | null;
  onFilters: (filters: Filters) => void;
  onRubric: (rubric: Rubric) => void;
  onVote: (profileId: string, match: boolean) => void;
  onApplyEdits: () => void;
  onRelax: (hint: EmptyHint) => void;
  onRefine: (message: string) => void;
  onFreeze: () => void;
  onNew: () => void;
  onRetry?: () => void;
};

export function Workspace({
  session,
  filters,
  rubric,
  votes,
  dirty,
  busy,
  thinkingMode,
  error,
  onFilters,
  onRubric,
  onVote,
  onApplyEdits,
  onRelax,
  onRefine,
  onFreeze,
  onNew,
  onRetry,
}: Props) {
  const pendingVotes = Object.keys(votes).length;
  const changes: SearchChange[] = session.changes;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-3">
          <div className="min-w-0">
            <p className="text-[11px] tracking-[0.2em] text-copper uppercase">
              Flexiple · Round {session.round}
            </p>
            <p className="truncate text-sm text-ink">{session.query}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onNew}
              className="rounded-full px-3 py-2 text-sm text-muted hover:text-ink"
            >
              New
            </button>
            <button
              type="button"
              onClick={onFreeze}
              disabled={busy}
              className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper-2 disabled:opacity-40"
            >
              Freeze search
            </button>
          </div>
        </div>
      </header>

      {session.recovery ? (
        <div className="border-b border-forest/20 bg-forest-soft px-5 py-2 text-center text-xs text-forest">
          {session.recovery}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-center gap-3 border-b border-wine/20 bg-wine-soft px-5 py-2 text-sm text-wine"
        >
          <span>{error}</span>
          {onRetry ? (
            <button type="button" onClick={onRetry} className="underline">
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mx-auto grid max-w-[1440px] gap-6 px-5 py-6 lg:grid-cols-[300px_minmax(0,1fr)_320px] lg:items-start">
        <SpecPanel
          filters={filters}
          rubric={rubric}
          disabled={busy}
          dirty={dirty}
          onFilters={onFilters}
          onRubric={onRubric}
          onApply={onApplyEdits}
        />

        <section className="min-w-0">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-serif text-2xl italic">Shortlist</h2>
            <p className="text-xs text-muted">
              Showing {session.page.length} of {session.totalRanked} scored ·{" "}
              {session.filteredCount}/{session.poolSize} passed filters
            </p>
          </div>

          {thinkingMode ? (
            <div className="rounded-3xl border border-line bg-paper-2 px-6 py-8">
              <p className="font-serif text-3xl italic">Working the map…</p>
              <div className="mt-6">
                <ThinkingSteps mode={thinkingMode} />
              </div>
              <div className="mt-8 space-y-3">
                {[0, 1, 2].map((key) => (
                  <div
                    key={key}
                    className="h-24 animate-pulse rounded-2xl bg-line/70"
                  />
                ))}
              </div>
            </div>
          ) : session.page.length === 0 ? (
            <EmptyResults
              filteredCount={session.filteredCount}
              poolSize={session.poolSize}
              hints={session.emptyHints}
              disabled={busy}
              onRelax={onRelax}
            />
          ) : (
            <div className="space-y-4">
              {session.changeSummary ? (
                <p className="rounded-2xl border border-copper/20 bg-copper-soft/50 px-4 py-3 text-sm leading-6">
                  {session.changeSummary}
                </p>
              ) : null}
              {session.page.map((item, index) => (
                <ProfileCard
                  key={item.profile.id}
                  item={item}
                  index={index}
                  filters={filters}
                  vote={votes[item.profile.id] ?? null}
                  disabled={busy}
                  onVote={(match) => onVote(item.profile.id, match)}
                />
              ))}
            </div>
          )}
        </section>

        <ChatPanel
          messages={session.messages}
          changes={changes}
          disabled={busy}
          pendingVotes={pendingVotes}
          onSend={onRefine}
        />
      </div>
    </div>
  );
}
