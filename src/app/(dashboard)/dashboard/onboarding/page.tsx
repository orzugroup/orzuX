import { redirect } from "next/navigation";
import { Suspense } from "react";

import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { DASHBOARD_ROUTES } from "@/constants/routes";
import { getCurrentUser } from "@/services/auth.service";
import { getPrimaryBusiness } from "@/services/business.service";
import {
  getEmptyOnboardingProgress,
  getOnboardingProgress,
} from "@/services/onboarding.service";
import { mapBusinessToProfile } from "@/utils/business";

type OnboardingPageProps = {
  searchParams: Promise<{ view?: string; step?: string }>;
};

function OnboardingWizardFallback() {
  return <div className="h-96 animate-pulse rounded-xl border bg-muted/30" />;
}

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const user = await getCurrentUser();
  const business = user ? await getPrimaryBusiness(user.id) : null;
  const defaultBusinessName =
    typeof user?.user_metadata?.business_name === "string"
      ? user.user_metadata.business_name
      : undefined;
  const params = await searchParams;
  const progress = business
    ? await getOnboardingProgress(business.id)
    : getEmptyOnboardingProgress();

  if (progress.isComplete) {
    redirect(DASHBOARD_ROUTES.overview);
  }

  if (progress.hasBusinessProfile) {
    const viewParam = params.view?.trim();
    const showOptionalRoadmap =
      viewParam === "continue" || viewParam === "optional";
    const showEdit = viewParam === "edit-profile";

    if (!showOptionalRoadmap && !showEdit) {
      redirect(DASHBOARD_ROUTES.overview);
    }
  }

  const view: "profile" | "continue" | "edit-profile" =
    !progress.hasBusinessProfile
      ? "profile"
      : params.view === "edit-profile"
        ? "edit-profile"
        : "continue";

  return (
    <div className="flex min-h-0 flex-1 flex-col p-3 md:p-4">
      <Suspense fallback={<OnboardingWizardFallback />}>
        <OnboardingWizard
          view={view}
          progress={progress}
          business={business ? mapBusinessToProfile(business) : null}
          defaultBusinessName={defaultBusinessName}
        />
      </Suspense>
    </div>
  );
}
