"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { OnboardingContinueRoadmap } from "@/components/onboarding/OnboardingContinueRoadmap";
import { OnboardingRequiredProfileStep } from "@/components/onboarding/OnboardingRequiredProfileStep";
import { OnboardingBusinessProfileForm } from "@/components/onboarding/OnboardingBusinessProfileForm";
import { Button } from "@/components/ui/button";
import { DASHBOARD_ROUTES } from "@/constants/routes";
import { ONBOARDING_MESSAGES } from "@/features/onboarding/constants";
import type { OnboardingProgress } from "@/services/onboarding.service";
import type { BusinessProfileData } from "@/types/business.types";

type OnboardingWizardProps = {
  view: "profile" | "continue" | "edit-profile";
  progress: OnboardingProgress;
  business: BusinessProfileData | null;
  defaultBusinessName?: string;
};

export function OnboardingWizard({
  view,
  progress,
  business,
  defaultBusinessName,
}: OnboardingWizardProps) {
  const router = useRouter();

  if (view === "continue" && progress.hasBusinessProfile) {
    return <OnboardingContinueRoadmap progress={progress} />;
  }

  if (view === "edit-profile" && progress.hasBusinessProfile) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link href={DASHBOARD_ROUTES.overview}>
              <ArrowLeftIcon className="size-4" />
              {ONBOARDING_MESSAGES.backToDashboard}
            </Link>
          </Button>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm md:p-8">
          <div className="mb-6 space-y-1">
            <h1 className="text-xl font-semibold">
              {ONBOARDING_MESSAGES.editProfileTitle}
            </h1>
            <p className="text-sm text-muted-foreground">
              {ONBOARDING_MESSAGES.stepBusinessDescription}
            </p>
          </div>
          <OnboardingBusinessProfileForm
            business={business}
            defaultBusinessName={defaultBusinessName}
            onSuccess={() => {
              router.refresh();
              router.push(DASHBOARD_ROUTES.overview);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <OnboardingRequiredProfileStep
      business={business}
      defaultBusinessName={defaultBusinessName}
      onSuccess={() => {
        router.refresh();
        router.push(`${DASHBOARD_ROUTES.onboarding}?view=continue`);
      }}
    />
  );
}
