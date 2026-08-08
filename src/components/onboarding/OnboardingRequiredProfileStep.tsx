"use client";

import { Building2Icon, MailIcon, SparklesIcon } from "lucide-react";

import { OnboardingBusinessProfileForm } from "@/components/onboarding/OnboardingBusinessProfileForm";
import { ONBOARDING_MESSAGES } from "@/features/onboarding/constants";
import { buildOptionalOnboardingSteps } from "@/features/onboarding/optional-steps";
import type { BusinessProfileData } from "@/types/business.types";

type OnboardingRequiredProfileStepProps = {
  business: BusinessProfileData | null;
  defaultBusinessName?: string;
  onSuccess: () => void;
};

const REQUIRED_FIELD_HINTS = [
  { icon: Building2Icon, label: "Name & description" },
  { icon: SparklesIcon, label: "Industry & business type" },
  { icon: MailIcon, label: "Business email (we send a confirmation)" },
] as const;

export function OnboardingRequiredProfileStep({
  business,
  defaultBusinessName,
  onSuccess,
}: OnboardingRequiredProfileStepProps) {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:items-start">
      <aside className="space-y-6 lg:sticky lg:top-6">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-destructive">
            {ONBOARDING_MESSAGES.mandatoryBadge}
            <span className="font-normal normal-case text-destructive/80">
              · Step 1 of 1
            </span>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {ONBOARDING_MESSAGES.pageTitle}
            </h1>
            <p className="text-sm text-muted-foreground md:text-base">
              {ONBOARDING_MESSAGES.pageDescription}
            </p>
          </div>
        </div>

        <ul className="space-y-3 rounded-xl border bg-muted/20 p-4 text-sm">
          {REQUIRED_FIELD_HINTS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3 text-muted-foreground">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background text-primary">
                <Icon className="size-4" />
              </span>
              <span>{label}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-left text-sm text-muted-foreground">
          <SparklesIcon className="mt-0.5 size-5 shrink-0 text-primary" />
          <p>{ONBOARDING_MESSAGES.aiFallbackHint}</p>
        </div>
      </aside>

      <div className="rounded-2xl border bg-card p-6 shadow-sm md:p-8">
        <div className="mb-6 space-y-1 border-b pb-6">
          <h2 className="text-lg font-semibold">
            {ONBOARDING_MESSAGES.stepBusinessTitle}
          </h2>
          <p className="text-sm text-muted-foreground">
            {ONBOARDING_MESSAGES.stepBusinessDescription}
          </p>
        </div>
        <OnboardingBusinessProfileForm
          business={business}
          defaultBusinessName={defaultBusinessName}
          requiredFieldsOnly
          onSuccess={onSuccess}
        />

        <div className="mt-8 space-y-3 border-t pt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            After this — optional
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {buildOptionalOnboardingSteps({
              hasBusinessProfile: false,
              hasBusiness: false,
              hasConnectedChannel: false,
              hasKnowledgeEntry: false,
              hasAiEnabled: false,
              connectedChannel: null,
              percentComplete: 0,
              isComplete: false,
              recommendedStep: 2,
            }).map((step) => (
              <li key={step.id} className="flex gap-2">
                <span className="text-primary">·</span>
                <span>{step.label}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {ONBOARDING_MESSAGES.optionalRoadmapHint}
          </p>
        </div>
      </div>
    </div>
  );
}
