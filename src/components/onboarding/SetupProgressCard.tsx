"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleIcon,
  XIcon,
} from "lucide-react";

import { OnboardingProgressRing } from "@/components/onboarding/OnboardingProgressRing";
import { Button } from "@/components/ui/button";
import { DASHBOARD_ROUTES } from "@/constants/routes";
import { ONBOARDING_MESSAGES } from "@/features/onboarding/constants";
import { countRemainingOptionalSteps } from "@/features/onboarding/optional-steps";
import { buildSetupSteps, getSetupProgressLabel } from "@/features/onboarding/setup-steps";
import { cn } from "@/lib/utils";
import type { OnboardingProgress } from "@/services/onboarding.service";

type SetupProgressCardProps = {
  progress: OnboardingProgress;
};

export function SetupProgressCard({ progress }: SetupProgressCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(true);

  if (!progress.hasBusinessProfile || progress.isComplete || dismissed) {
    return null;
  }

  const steps = buildSetupSteps(progress).filter((step) => !step.required);
  const remaining = countRemainingOptionalSteps(progress);
  const { title, description } = getSetupProgressLabel(progress);

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[48] px-3 md:bottom-6 md:left-auto md:right-4 md:max-w-md md:px-0",
      )}
      role="region"
      aria-label={title}
    >
      <div className="overflow-hidden rounded-2xl border bg-background/95 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-background/90">
        <div className="flex items-start gap-3 border-b bg-muted/30 p-4">
          <OnboardingProgressRing percent={progress.percentComplete} size={48} />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-semibold leading-snug">{title}</p>
            <p className="text-xs text-muted-foreground">
              {ONBOARDING_MESSAGES.optionalStepsRemaining(remaining)}
            </p>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Dismiss setup reminder"
            onClick={() => setDismissed(true)}
          >
            <XIcon className="size-4" />
          </button>
        </div>

        {expanded ? (
          <div className="space-y-3 p-4">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
            <ul className="space-y-2">
              {steps.map((step) => (
                <li key={step.id}>
                  <Link
                    href={step.href}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                      step.done
                        ? "border-primary/20 bg-primary/5 text-muted-foreground"
                        : "border-border bg-card hover:border-primary/30 hover:bg-muted/30",
                    )}
                  >
                    {step.done ? (
                      <CheckCircle2Icon className="size-4 shrink-0 text-primary" />
                    ) : (
                      <CircleIcon className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className={step.done ? "line-through" : "font-medium"}>
                      {step.label}
                    </span>
                    {!step.done ? (
                      <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {ONBOARDING_MESSAGES.optionalBadge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild size="sm" className="flex-1">
                <Link href={`${DASHBOARD_ROUTES.onboarding}?view=continue`}>
                  {ONBOARDING_MESSAGES.continue}
                  <ArrowRightIcon className="size-4" />
                </Link>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="flex-1"
                onClick={() => setExpanded(false)}
              >
                {ONBOARDING_MESSAGES.skipSetup}
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-3">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-full"
              onClick={() => setExpanded(true)}
            >
              {ONBOARDING_MESSAGES.continue}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
