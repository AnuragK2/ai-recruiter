"use client";

import { KeyboardEvent, useState } from "react";

type Props = {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function TagInput({ values, onChange, placeholder, disabled }: Props) {
  const [draft, setDraft] = useState("");

  function commit() {
    const next = draft.trim();
    if (!next) return;
    if (!values.some((value) => value.toLowerCase() === next.toLowerCase())) {
      onChange([...values, next]);
    }
    setDraft("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit();
    }
    if (event.key === "Backspace" && !draft && values.length) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5 rounded-xl border border-line bg-paper-2 px-2 py-2">
      {values.map((value) => (
        <button
          key={value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(values.filter((item) => item !== value))}
          className="rounded-full bg-ink/5 px-2.5 py-1 text-xs text-ink transition hover:bg-wine-soft hover:text-wine"
        >
          {value} ×
        </button>
      ))}
      <input
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        placeholder={values.length ? "" : placeholder}
        className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-xs text-ink outline-none placeholder:text-muted"
      />
    </div>
  );
}
