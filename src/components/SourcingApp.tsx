"use client";

import { useMemo, useState } from "react";
import { ApiError, createSession, freezeSession, patchSession, refineSession } from "@/lib/api";
import type {
  EmptyHint,
  Filters,
  PublicSession,
  Rubric,
  Vote,
} from "@/lib/types";
import { FrozenView } from "./FrozenView";
import { SearchLanding } from "./SearchLanding";
import { ThinkingSteps } from "./ThinkingSteps";
import { Workspace } from "./Workspace";

type Draft = { filters: Filters; rubric: Rubric };
type ThinkingMode = "search" | "refine" | "edit";

export function SourcingApp() {
  const [session, setSession] = useState<PublicSession | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [votes, setVotes] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState<ThinkingMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<(() => void) | null>(null);

  const dirty = useMemo(() => {
    if (!session || !draft) return false;
    return (
      JSON.stringify(draft.filters) !== JSON.stringify(session.filters) ||
      JSON.stringify(draft.rubric) !== JSON.stringify(session.rubric)
    );
  }, [draft, session]);

  function applySession(next: PublicSession) {
    setSession(next);
    setDraft({ filters: next.filters, rubric: next.rubric });
    setVotes({});
    setError(null);
    setRetry(null);
  }

  function fail(err: unknown, again: () => void) {
    const message =
      err instanceof ApiError
        ? err.message
        : "Something unexpected happened. Try again.";
    setError(message);
    setRetry(() => again);
  }

  async function start(query: string) {
    setBusy(true);
    setThinking("search");
    setError(null);
    try {
      const { session: next } = await createSession(query);
      applySession(next);
    } catch (err) {
      fail(err, () => start(query));
      setSession(null);
      setDraft(null);
    } finally {
      setBusy(false);
      setThinking(null);
    }
  }

  async function refine(message: string) {
    if (!session) return;
    const voteList: Vote[] = Object.entries(votes).map(([profileId, match]) => ({
      profileId,
      match,
    }));
    if (!message.trim() && voteList.length === 0) {
      setError("Mark a profile or write what felt off.");
      return;
    }
    setBusy(true);
    setThinking("refine");
    setError(null);
    try {
      const { session: next } = await refineSession(session.id, {
        message: message.trim(),
        votes: voteList,
      });
      applySession(next);
    } catch (err) {
      fail(err, () => refine(message));
    } finally {
      setBusy(false);
      setThinking(null);
    }
  }

  async function applyEdits(nextFilters?: Filters, nextRubric?: Rubric) {
    if (!session || !draft) return;
    const filters = nextFilters ?? draft.filters;
    const rubric = nextRubric ?? draft.rubric;
    setBusy(true);
    setThinking("edit");
    setError(null);
    try {
      const { session: next } = await patchSession(session.id, filters, rubric);
      applySession(next);
    } catch (err) {
      fail(err, () => applyEdits(filters, rubric));
    } finally {
      setBusy(false);
      setThinking(null);
    }
  }

  async function freeze() {
    if (!session) return;
    setBusy(true);
    try {
      const { session: next } = await freezeSession(session.id);
      applySession(next);
    } catch (err) {
      fail(err, freeze);
    } finally {
      setBusy(false);
    }
  }

  function relax(hint: EmptyHint) {
    if (!draft) return;
    setDraft({ ...draft, filters: hint.filters });
    void applyEdits(hint.filters, draft.rubric);
  }

  function reset() {
    setSession(null);
    setDraft(null);
    setVotes({});
    setError(null);
    setRetry(null);
    setThinking(null);
    setBusy(false);
  }

  if (session?.status === "frozen" && !busy) {
    return <FrozenView session={session} onNew={reset} />;
  }

  if (!session || !draft) {
    if (busy) {
      return (
        <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6">
          <p className="text-xs tracking-[0.2em] text-copper uppercase">Sourcing</p>
          <h1 className="mt-4 font-serif text-4xl italic">Working the map…</h1>
          <div className="mt-8">
            <ThinkingSteps mode="search" />
          </div>
        </main>
      );
    }
    return <SearchLanding busy={busy} error={error} onSubmit={start} />;
  }

  return (
    <Workspace
      session={session}
      filters={draft.filters}
      rubric={draft.rubric}
      votes={votes}
      dirty={dirty}
      busy={busy}
      thinkingMode={thinking}
      error={error}
      onFilters={(filters) => setDraft({ ...draft, filters })}
      onRubric={(rubric) => setDraft({ ...draft, rubric })}
      onVote={(profileId, match) =>
        setVotes((current) => ({ ...current, [profileId]: match }))
      }
      onApplyEdits={() => applyEdits()}
      onRelax={relax}
      onRefine={refine}
      onFreeze={freeze}
      onNew={reset}
      onRetry={retry ?? undefined}
    />
  );
}
