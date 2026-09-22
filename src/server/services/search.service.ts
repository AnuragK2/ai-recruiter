import { diffSearch } from "@/lib/diff";
import { sanitizeText } from "@/lib/sanitize";
import type {
  Filters,
  PublicSession,
  RankedProfile,
  Rubric,
  SearchSession,
  Vote,
} from "@/lib/types";
import { TtlCache } from "../cache";
import { KeyedMutex } from "../concurrency";
import { getConfig } from "../config";
import { AppError } from "../errors";
import { logger } from "../logger";
import type { ProfileRepository } from "../repositories/profile.repository";
import type { SessionRepository } from "../repositories/session.repository";
import { serializeSession } from "../serializers/session.serializer";
import type { FilterService } from "./filter.service";
import type { LlmService } from "./llm.service";

function recoveryNote(recovered: boolean, stage: string): string | null {
  if (!recovered) return null;
  return `Recovered from a malformed model response while ${stage}. The result below was re-validated.`;
}

function mergeRecovery(current: string | null, next: string | null): string | null {
  if (current && next) return `${current} ${next}`;
  return next ?? current;
}

export class SearchService {
  private readonly locks = new KeyedMutex();
  private readonly idempotency = new TtlCache<PublicSession>(
    getConfig().IDEMPOTENCY_TTL_MS,
  );

  constructor(
    private readonly sessions: SessionRepository,
    private readonly profiles: ProfileRepository,
    private readonly filters: FilterService,
    private readonly llm: LlmService,
  ) {}

  async start(query: string, idempotencyKey?: string | null): Promise<PublicSession> {
    const key = idempotencyKey?.trim();
    if (key) {
      const cached = this.idempotency.get(key);
      if (cached) return cached;
    }

    const safeQuery = sanitizeText(query, 800);
    const generated = await this.llm.generate(safeQuery);
    const session = this.sessions.create({
      query: safeQuery,
      filters: generated.data.filters,
      rubric: generated.data.rubric,
    });
    session.recovery = recoveryNote(
      generated.recovered,
      "drafting filters and rubric",
    );
    this.sessions.addMessage(
      session,
      "system",
      "Drafted objective filters and a fit rubric from your brief, then ranked the first shortlist.",
    );
    await this.executeRound(session);
    this.sessions.save(session);
    const publicSession = this.toPublic(session);
    if (key) this.idempotency.set(key, publicSession);
    return publicSession;
  }

  get(id: string): PublicSession {
    return this.toPublic(this.sessions.get(id));
  }

  async applyEdits(id: string, filters: Filters, rubric: Rubric): Promise<PublicSession> {
    return this.locks.runExclusive(id, async () => {
      const session = this.sessions.get(id);
      this.sessions.requireActive(session);
      const changes = diffSearch(
        session.filters,
        filters,
        session.rubric,
        rubric,
        "Applied your manual edits and re-ran the search.",
      );
      session.filters = structuredClone(filters);
      session.rubric = structuredClone(rubric);
      session.changes = changes;
      session.changeSummary =
        changes.length > 0
          ? "Applied your edits to the spec and re-scored the talent map."
          : "No spec changes; re-scored with the same filters and rubric.";
      session.recovery = null;
      this.sessions.addMessage(session, "recruiter", "Updated the filters and rubric directly.");
      this.sessions.addMessage(session, "assistant", session.changeSummary);
      await this.executeRound(session);
      this.sessions.save(session);
      return this.toPublic(session);
    });
  }

  async refine(
    id: string,
    input: { message: string; votes: Vote[] },
  ): Promise<PublicSession> {
    return this.locks.runExclusive(id, async () => {
      const session = this.sessions.get(id);
      this.sessions.requireActive(session);
      const pageSize = getConfig().PAGE_SIZE;
      const page = (session.ranked ?? []).slice(0, pageSize);
      const message = sanitizeText(input.message ?? "", 1000);
      const votes = (input.votes ?? []).filter((vote) =>
        page.some((item) => item.profile.id === vote.profileId),
      );

      if (page.length === 0 && !message) {
        throw new AppError(
          "validation",
          "There is no shortlist to vote on. Relax a filter or describe what to change.",
        );
      }

      const recruiterText =
        message ||
        votes
          .map((vote) => {
            const n = page.findIndex((item) => item.profile.id === vote.profileId) + 1;
            return `${n} is ${vote.match ? "a match" : "not a match"}`;
          })
          .join("; ");

      this.sessions.addMessage(session, "recruiter", recruiterText);

      const refined = await this.llm.refine({
        query: session.query,
        filters: session.filters,
        rubric: session.rubric,
        page,
        votes,
        message,
      });

      const computed = diffSearch(
        session.filters,
        refined.data.filters,
        session.rubric,
        refined.data.rubric,
        refined.data.change_summary,
      );
      session.filters = structuredClone(refined.data.filters);
      session.rubric = structuredClone(refined.data.rubric);
      session.changeSummary = refined.data.change_summary;
      session.changes = refined.data.changes.length ? refined.data.changes : computed;
      session.recovery = recoveryNote(refined.recovered, "interpreting your feedback");
      this.sessions.addMessage(session, "assistant", session.changeSummary);
      await this.executeRound(session);
      this.sessions.save(session);
      return this.toPublic(session);
    });
  }

  async freeze(id: string): Promise<PublicSession> {
    return this.locks.runExclusive(id, async () => {
      const session = this.sessions.get(id);
      this.sessions.requireActive(session);
      session.status = "frozen";
      session.frozenAt = Date.now();
      this.sessions.addMessage(
        session,
        "system",
        "Search frozen. Filters, rubric, and ranked shortlist are locked.",
      );
      this.sessions.save(session);
      return this.toPublic(session);
    });
  }

  private async executeRound(session: SearchSession): Promise<void> {
    const filtered = this.filters.apply(session.filters);
    session.filteredCount = filtered.length;
    session.emptyHints =
      filtered.length === 0 ? this.filters.hints(session.filters) : [];

    if (filtered.length === 0) {
      session.ranked = [];
      session.round += 1;
      return;
    }

    const toScore = this.filters
      .preRank(filtered, session.filters)
      .slice(0, getConfig().SCORE_CAP);
    const scored = await this.llm.score({
      query: session.query,
      rubric: session.rubric,
      profiles: toScore,
    });
    session.recovery = mergeRecovery(
      session.recovery,
      recoveryNote(scored.recovered, "scoring profiles"),
    );

    const byId = new Map(toScore.map((profile) => [profile.id, profile]));
    const ranked: RankedProfile[] = [];

    for (const item of scored.data.scores ?? []) {
      const profile = byId.get(item.profile_id);
      if (!profile) continue;
      ranked.push({
        profile,
        score: Math.round(item.score),
        explanation: item.explanation,
        evidence: item.evidence ?? [],
      });
    }

    for (const profile of toScore) {
      if (ranked.some((item) => item.profile.id === profile.id)) continue;
      ranked.push({
        profile,
        score: 40,
        explanation:
          "The model skipped this profile. Ranked using overlap with the current filters only.",
        evidence: [
          {
            field: "skills",
            quote: profile.skills.join(", ") || "none listed",
            why: "Fallback ranking after a partial model response.",
          },
        ],
      });
    }

    ranked.sort((a, b) => b.score - a.score);
    session.ranked = ranked;
    session.round += 1;
    logger.info({
      msg: "search.round",
      session_id: session.id,
      round: session.round,
      filtered: session.filteredCount,
      scored: ranked.length,
    });
  }

  private toPublic(session: SearchSession): PublicSession {
    const dto = serializeSession(session);
    dto.poolSize = this.profiles.size;
    return dto;
  }
}
