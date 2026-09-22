"use client";

import type { EmptyHint } from "@/lib/types";

type Props = {
  filteredCount: number;
  poolSize: number;
  hints: EmptyHint[];
  disabled?: boolean;
  onRelax: (hint: EmptyHint) => void;
};

export function EmptyResults({
  filteredCount,
  poolSize,
  hints,
  disabled,
  onRelax,
}: Props) {
  return (
    <div className="rounded-3xl border border-dashed border-line-strong bg-paper-2 px-6 py-10 text-center">
      <p className="text-[11px] tracking-[0.18em] text-muted uppercase">
        Empty shortlist
      </p>
      <h3 className="mt-3 font-serif text-3xl">Nobody survived the filters.</h3>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted">
        {filteredCount} of {poolSize} profiles matched. The rubric never ran.
        Relax a hard constraint — taste belongs in the rubric.
      </p>
      {hints.length > 0 ? (
        <div className="mx-auto mt-6 flex max-w-md flex-col gap-2">
          {hints.map((hint) => (
            <button
              key={hint.id}
              type="button"
              disabled={disabled}
              onClick={() => onRelax(hint)}
              className="rounded-2xl border border-line px-4 py-3 text-left transition hover:border-copper hover:bg-copper-soft/40"
            >
              <p className="text-sm font-medium">{hint.label}</p>
              <p className="mt-1 text-xs leading-5 text-muted">{hint.detail}</p>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">
          Tell the chat what to drop, or edit the filters yourself.
        </p>
      )}
    </div>
  );
}
