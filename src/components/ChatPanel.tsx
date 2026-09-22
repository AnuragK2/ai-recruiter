"use client";

import { FormEvent, useRef } from "react";
import type { ChatMessage, SearchChange } from "@/lib/types";

type Props = {
  messages: ChatMessage[];
  changes: SearchChange[];
  disabled?: boolean;
  pendingVotes: number;
  onSend: (message: string) => void;
};

export function ChatPanel({
  messages,
  changes,
  disabled,
  pendingVotes,
  onSend,
}: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = inputRef.current?.value ?? "";
    onSend(value);
    if (inputRef.current) inputRef.current.value = "";
  }

  const visible = messages.filter((message) => message.role !== "system");

  return (
    <aside className="flex h-full min-h-[28rem] flex-col">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-2xl italic">Feedback</h2>
        <span className="text-[11px] tracking-[0.16em] text-muted uppercase">
          Round by round
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-muted">
        Talk like a recruiter. “1 is too junior, 2 and 4 are right.” Or use the
        match buttons, then send.
      </p>

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
        {visible.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-3 py-4 text-sm leading-6 text-muted">
            Nothing here yet. Mark profiles or type what felt off.
          </p>
        ) : (
          visible.map((message) => (
            <div
              key={message.id}
              className={`rounded-2xl px-3 py-2.5 text-sm leading-6 ${
                message.role === "recruiter"
                  ? "ml-6 bg-ink text-paper-2"
                  : "mr-4 border border-line bg-paper-2 text-ink"
              }`}
            >
              {message.content}
            </div>
          ))
        )}
      </div>

      {changes.length > 0 ? (
        <div className="mt-3 rounded-2xl border border-copper/20 bg-copper-soft/60 p-3">
          <p className="text-[11px] tracking-[0.14em] text-copper uppercase">
            What changed
          </p>
          <ul className="mt-2 space-y-1.5">
            {changes.slice(0, 4).map((change) => (
              <li key={`${change.area}-${change.field}`} className="text-xs leading-5">
                <span className="font-medium">
                  {change.area} · {change.field}
                </span>
                <span className="text-muted">
                  {" "}
                  {change.before || "—"} → {change.after || "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form onSubmit={submit} className="mt-3">
        <textarea
          ref={inputRef}
          rows={3}
          disabled={disabled}
          placeholder="1 is too junior, 2 and 4 are right"
          className="w-full resize-none rounded-2xl border border-line bg-paper-2 px-3 py-2 text-sm leading-6 outline-none ring-copper/30 focus:ring-4 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled}
          className="mt-2 w-full rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-paper-2 disabled:opacity-40"
        >
          {pendingVotes > 0
            ? `Update search · ${pendingVotes} vote${pendingVotes === 1 ? "" : "s"}`
            : "Update search"}
        </button>
      </form>
    </aside>
  );
}
