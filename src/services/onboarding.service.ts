import "server-only";

import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/env";
import {
  MESSAGING_INTEGRATION_CHANNELS,
  type MessagingIntegrationChannelId,
} from "@/features/integrations";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getChannelAiSettings,
  getChannelConnectionStatuses,
} from "@/services/channel-workspace.service";
import { isBusinessProfileComplete } from "@/utils/business";
import type { Business } from "@/types/database.types";

export type OnboardingProgress = {
  /** Required onboarding step — full business profile */
  hasBusinessProfile: boolean;
  hasBusiness: boolean;
  hasConnectedChannel: boolean;
  hasKnowledgeEntry: boolean;
  hasAiEnabled: boolean;
  connectedChannel: MessagingIntegrationChannelId | null;
  percentComplete: number;
  /** All recommended optional steps finished */
  isComplete: boolean;
  /** Legacy alias for recommended step index in optional roadmap */
  recommendedStep: number;
};

const OPTIONAL_STEP_WEIGHTS = {
  channel: 25,
  ai: 35,
  knowledge: 15,
} as const;
const PROFILE_WEIGHT = 25;

function getFirstConnectedChannel(
  statuses: Awaited<ReturnType<typeof getChannelConnectionStatuses>>,
): MessagingIntegrationChannelId | null {
  for (const channel of MESSAGING_INTEGRATION_CHANNELS) {
    if (statuses[channel]?.status === "connected") {
      return channel;
    }
  }

  return null;
}

async function buildOnboardingProgress(
  business: Business,
  knowledgeCount: number,
): Promise<OnboardingProgress> {
  const businessId = business.id;
  const hasBusinessProfile = isBusinessProfileComplete(business);
  const channelStatuses = await getChannelConnectionStatuses(businessId);
  const connectedChannel = getFirstConnectedChannel(channelStatuses);
  const hasConnectedChannel = connectedChannel !== null;
  const hasKnowledgeEntry = knowledgeCount > 0;
  const channelAiSettings =
    connectedChannel !== null
      ? await getChannelAiSettings(connectedChannel)
      : null;
  const hasAiEnabled = channelAiSettings?.aiEnabled === true;

  let percentComplete = 0;
  if (hasBusinessProfile) percentComplete += PROFILE_WEIGHT;
  if (hasConnectedChannel) percentComplete += OPTIONAL_STEP_WEIGHTS.channel;
  if (hasAiEnabled) percentComplete += OPTIONAL_STEP_WEIGHTS.ai;
  if (hasKnowledgeEntry) percentComplete += OPTIONAL_STEP_WEIGHTS.knowledge;

  const isComplete =
    hasBusinessProfile &&
    hasConnectedChannel &&
    hasAiEnabled &&
    hasKnowledgeEntry;

  let recommendedStep = 1;
  if (!hasBusinessProfile) {
    recommendedStep = 1;
  } else if (!hasConnectedChannel) {
    recommendedStep = 2;
  } else if (!hasAiEnabled) {
    recommendedStep = 3;
  } else {
    recommendedStep = 4;
  }

  return {
    hasBusinessProfile,
    hasBusiness: hasBusinessProfile,
    hasConnectedChannel,
    hasKnowledgeEntry,
    hasAiEnabled,
    connectedChannel,
    percentComplete,
    isComplete,
    recommendedStep,
  };
}

async function loadBusinessRow(businessId: string): Promise<Business | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .maybeSingle();

  return data ?? null;
}

export async function getOnboardingProgress(
  businessId: string,
): Promise<OnboardingProgress> {
  if (!hasSupabaseEnv()) {
    return getEmptyOnboardingProgress();
  }

  const business = await loadBusinessRow(businessId);
  if (!business) {
    return getEmptyOnboardingProgress();
  }

  const supabase = await createClient();
  const knowledgeResult = await supabase
    .from("knowledge_base")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);

  return buildOnboardingProgress(business, knowledgeResult.count ?? 0);
}

/** Service-role onboarding check for cron jobs and background email logic. */
export async function getOnboardingProgressForSystem(
  businessId: string,
): Promise<OnboardingProgress> {
  if (!hasSupabaseEnv()) {
    return getEmptyOnboardingProgress();
  }

  const admin = createAdminClient();
  const { data: business } = await admin
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .maybeSingle();

  if (!business) {
    return getEmptyOnboardingProgress();
  }

  const knowledgeResult = await admin
    .from("knowledge_base")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);

  return buildOnboardingProgress(business, knowledgeResult.count ?? 0);
}

export function getEmptyOnboardingProgress(): OnboardingProgress {
  return {
    hasBusinessProfile: false,
    hasBusiness: false,
    hasConnectedChannel: false,
    hasKnowledgeEntry: false,
    hasAiEnabled: false,
    connectedChannel: null,
    percentComplete: 0,
    isComplete: false,
    recommendedStep: 1,
  };
}
