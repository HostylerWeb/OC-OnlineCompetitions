"use client";

import { cn } from "@/lib/utils";

export type SkillQuestionSelectorProps = {
  question: string;
  options: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  instructionTitle: string;
};

export function SkillQuestionSelector({
  question,
  options,
  selectedIndex,
  onSelect,
  instructionTitle,
}: SkillQuestionSelectorProps) {
  return (
    <div className="space-y-3 pt-2">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 shadow-[0_5px_20px_rgba(0,0,0,0.15)]">
        <p className="mb-3 text-center text-xs font-bold uppercase leading-snug tracking-wide text-gold sm:text-sm">
          {instructionTitle}
        </p>

        <p className="mb-3 text-center text-base font-semibold uppercase leading-snug tracking-wide text-foreground sm:text-lg lg:text-xl">
          {question}
        </p>

        <div
          className="grid grid-cols-2 gap-2 lg:grid-cols-4"
          role="radiogroup"
          aria-label={question}
        >
          {options.map((option, idx) => {
            const selected = selectedIndex === idx;
            return (
              <button
                key={idx}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onSelect(idx)}
                className={cn(
                  "skill-answer-chip",
                  selected && "skill-answer-chip-selected",
                )}
                data-umami-event="competition:skill-answer"
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
