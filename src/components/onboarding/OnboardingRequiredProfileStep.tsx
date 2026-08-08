"use client";

import { OnboardingBusinessProfileForm } from "@/components/onboarding/OnboardingBusinessProfileForm";
import { ONBOARDING_MESSAGES } from "@/features/onboarding/constants";
import type { BusinessProfileData } from "@/types/business.types";

type OnboardingRequiredProfileStepProps = {
  business: BusinessProfileData | null;
  defaultBusinessName?: string;
  onSuccess: () => void;
};

export function OnboardingRequiredProfileStep({
  business,
  defaultBusinessName,
  onSuccess,
}: OnboardingRequiredProfileStepProps) {
  return (
    <div className="flex min-h-[calc(100dvh-5.5rem)] w-full flex-1 items-stretch justify-center">
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
        <header className="shrink-0 space-y-1 border-b px-5 py-4 md:px-7 md:py-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/5 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-destructive">
            {ONBOARDING_MESSAGES.mandatoryBadge}
          </div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            {ONBOARDING_MESSAGES.pageTitle}
          </h1>
          <p className="text-sm text-muted-foreground">
            {ONBOARDING_MESSAGES.pageDescription}
          </p>
        </header>

        <div className="flex min-h-0 flex-1 flex-col px-5 py-4 md:px-7 md:py-5">
          <OnboardingBusinessProfileForm
            business={business}
            defaultBusinessName={defaultBusinessName}
            compact
            onSuccess={onSuccess}
          />
        </div>
      </div>
    </div>
  );
}
