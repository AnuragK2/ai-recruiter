import { randomUUID } from "node:crypto";
import { getConfig } from "../config";
import { AppError } from "../errors";
import type {
  ChatMessage,
  Filters,
  Rubric,
  SearchSession,
} from "@/lib/types";

export class SessionRepository {
  private readonly sessions = new Map<string, SearchSession>();

  create(input: { query: string; filters: Filters; rubric: Rubric }): SearchSession {
    this.sweep();
    const session: SearchSession = {
      id: randomUUID(),
      createdAt: Date.now(),
      frozenAt: null,
      status: "active",
      query: input.query,
      filters: structuredClone(input.filters),
      rubric: structuredClone(input.rubric),
      round: 0,
      messages: [],
      changeSummary: null,
      changes: [],
      recovery: null,
      ranked: [],
      filteredCount: 0,
      emptyHints: [],
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string): SearchSession {
    this.sweep();
    const session = this.sessions.get(id);
    if (!session) {
      throw new AppError("not_found", "That search session is gone. Start a new one.");
    }
    return session;
  }

  requireActive(session: SearchSession): void {
    if (session.status === "frozen") {
      throw new AppError(
        "conflict",
        "This search is frozen. Start a new one to keep exploring.",
      );
    }
  }

  addMessage(
    session: SearchSession,
    role: ChatMessage["role"],
    content: string,
  ): ChatMessage {
    const message: ChatMessage = {
      id: randomUUID(),
      role,
      content,
      createdAt: new Date().toISOString(),
    };
    session.messages.push(message);
    return message;
  }

  save(session: SearchSession): void {
    this.sessions.set(session.id, session);
  }

  get size(): number {
    this.sweep();
    return this.sessions.size;
  }

  private sweep(now = Date.now()): void {
    const ttl = getConfig().SESSION_TTL_MS;
    for (const [id, session] of this.sessions) {
      const anchor = session.frozenAt ?? session.createdAt;
      if (now - anchor > ttl) this.sessions.delete(id);
    }
  }
}
