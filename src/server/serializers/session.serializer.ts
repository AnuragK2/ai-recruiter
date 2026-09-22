import { getConfig } from "../config";
import type { PublicSession, SearchSession } from "@/lib/types";

export function serializeSession(session: SearchSession): PublicSession {
  const frozen = session.status === "frozen";
  const pageSize = getConfig().PAGE_SIZE;
  const ranked = session.ranked ?? [];
  return {
    id: session.id,
    status: session.status,
    query: session.query,
    round: session.round,
    filters: structuredClone(session.filters),
    rubric: structuredClone(session.rubric),
    messages: structuredClone(session.messages ?? []),
    changeSummary: session.changeSummary ?? null,
    changes: structuredClone(session.changes ?? []),
    recovery: session.recovery ?? null,
    page: structuredClone(ranked.slice(0, pageSize)),
    pageSize,
    totalRanked: ranked.length,
    filteredCount: session.filteredCount ?? 0,
    poolSize: 0,
    emptyHints: structuredClone(session.emptyHints ?? []),
    frozenAt: session.frozenAt ? new Date(session.frozenAt).toISOString() : null,
    ranked: frozen ? structuredClone(ranked) : null,
  };
}
