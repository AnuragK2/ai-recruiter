"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "Reading the brief",
  "Drafting filters and rubric",
  "Searching the talent map",
  "Scoring against the rubric",
];

const REFINE_STEPS = [
  "Interpreting your feedback",
  "Updating filters and rubric",
  "Re-running the search",
  "Re-scoring the shortlist",
];

type Props = {
  mode: "search" | "refine" | "edit";
};

export function ThinkingSteps({ mode }: Props) {
  const steps =
    mode === "refine"
      ? REFINE_STEPS
      : mode === "edit"
        ? ["Applying your edits", "Searching the talent map", "Re-scoring the shortlist"]
        : STEPS;
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((current) => Math.min(current + 1, steps.length - 1));
    }, 2800);
    return () => window.clearInterval(timer);
  }, [steps.length]);

  return (
    <ol className="space-y-3">
      {steps.map((step, index) => {
        const done = index < active;
        const current = index === active;
        return (
          <li key={step} className="flex items-center gap-3 text-sm">
            <span
              className={`h-2 w-2 rounded-full ${
                current
                  ? "animate-pulse bg-copper"
                  : done
                    ? "bg-forest"
                    : "bg-line-strong"
              }`}
            />
            <span className={current ? "text-ink" : "text-muted"}>{step}</span>
          </li>
        );
      })}
    </ol>
  );
}
