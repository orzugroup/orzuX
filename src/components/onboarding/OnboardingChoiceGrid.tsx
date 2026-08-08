"use client";

import { BUSINESS_SECTOR_OTHER, BUSINESS_TYPE_OTHER } from "@/features/business/sectors";
import { cn } from "@/lib/utils";

type ChoiceOption = {
  value: string;
  label: string;
};

type OnboardingChoiceGridProps = {
  name: string;
  options: readonly ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  columns?: 2 | 3;
};

export function OnboardingChoiceGrid({
  name,
  options,
  value,
  onChange,
  invalid,
  columns = 2,
}: OnboardingChoiceGridProps) {
  return (
    <div
      className={cn(
        "grid gap-2",
        columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2",
        invalid && "rounded-lg ring-2 ring-destructive/40 ring-offset-2",
      )}
      role="radiogroup"
      aria-invalid={invalid}
    >
      {options.map((option) => {
        const selected = value === option.value;
        const isOther =
          option.value === BUSINESS_SECTOR_OTHER ||
          option.value === BUSINESS_TYPE_OTHER;

        return (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors",
              selected
                ? "border-primary bg-primary/5 font-medium text-foreground"
                : "border-border bg-background hover:border-primary/40 hover:bg-muted/30",
            )}
          >
            <input
              type="radio"
              name={name || undefined}
              value={option.value}
              checked={selected}
              className="sr-only"
              onChange={() => onChange(option.value)}
            />
            <span
              className={cn(
                "size-2 shrink-0 rounded-full border",
                selected ? "border-primary bg-primary" : "border-muted-foreground/40",
              )}
              aria-hidden
            />
            <span className="leading-snug">
              {option.label}
              {isOther ? (
                <span className="block text-xs font-normal text-muted-foreground">
                  Type your own
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}
