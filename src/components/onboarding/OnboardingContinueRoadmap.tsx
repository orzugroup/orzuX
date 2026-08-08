"use client";

import Link from "next/link";
import { ArrowRightIcon, CheckCircle2Icon } from "lucide-react";

import { OnboardingProgressRing } from "@/components/onboarding/OnboardingProgressRing";
import { Button } from "@/components/ui/button";
import { DASHBOARD_ROUTES } from "@/constants/routes";
import { ONBOARDING_MESSAGES } from "@/features/onboarding/constants";
import {
  buildOptionalOnboardingSteps,
  countRemainingOptionalSteps,
} from "@/features/onboarding/optional-steps";
import { cn } from "@/lib/utils";
import type { OnboardingProgress } from "@/services/onboarding.service";

type OnboardingContinueRoadmapProps = {
  progress: OnboardingProgress;
};

export function OnboardingContinueRoadmap({
  progress,
}: OnboardingContinueRoadmapProps) {
  const steps = buildOptionalOnboardingSteps(progress);
  const remaining = countRemainingOptionalSteps(progress);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <OnboardingProgressRing percent={progress.percentComplete} size={64} />
          <div className="space-y-1">
            <p className="text-sm font-medium text-primary">
              {ONBOARDING_MESSAGES.profileCompleteBadge}
            </p>
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
              {ONBOARDING_MESSAGES.stepContinueTitle}
            </h1>
            <p className="text-sm text-muted-foreground">
              {remaining > 0
                ? ONBOARDING_MESSAGES.optionalStepsRemaining(remaining)
                : ONBOARDING_MESSAGES.stepContinueDescription}
            </p>
          </div>
        </div>
        <Button type="button" asChild className="shrink-0">
          <Link href={DASHBOARD_ROUTES.overview}>
            {ONBOARDING_MESSAGES.goToDashboard}
            <ArrowRightIcon className="size-4" />
          </Link>
        </Button>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
        {ONBOARDING_MESSAGES.incompleteSetupBanner}
      </div>

      <ul className="grid gap-4 sm:grid-cols-1">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <li
              key={step.id}
              className={cn(
                "flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between",
                step.done ? "border-primary/25 bg-primary/5" : "bg-card",
              )}
            >
              <div className="flex gap-4">
                <div
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-lg border",
                    step.done
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "bg-muted/50 text-muted-foreground",
                  )}
                >
                  {step.done ? (
                    <CheckCircle2Icon className="size-5" />
                  ) : (
                    <Icon className="size-5" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{step.label}</p>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {ONBOARDING_MESSAGES.optionalBadge}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </div>
              {!step.done ? (
                <Button type="button" size="sm" variant="secondary" asChild>
                  <Link href={step.href}>{ONBOARDING_MESSAGES.openStep}</Link>
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>

      <p className="text-center text-xs text-muted-foreground">
        {ONBOARDING_MESSAGES.optionalRoadmapHint}
      </p>
    </div>
  );
}
