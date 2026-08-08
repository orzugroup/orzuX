import type { LucideIcon } from "lucide-react";
import {
  BookOpenIcon,
  BotIcon,
  PlugIcon,
} from "lucide-react";

import { DASHBOARD_ROUTES } from "@/constants/routes";
import { ONBOARDING_MESSAGES } from "@/features/onboarding/constants";
import { buildAiAssistantHref } from "@/utils/ai-assistant-url";
import type { OnboardingProgress } from "@/services/onboarding.service";

export type OptionalOnboardingStep = {
  id: "channel" | "ai" | "knowledge";
  label: string;
  description: string;
  done: boolean;
  href: string;
  icon: LucideIcon;
};

export function buildOptionalOnboardingSteps(
  progress: OnboardingProgress,
): OptionalOnboardingStep[] {
  return [
    {
      id: "channel",
      label: ONBOARDING_MESSAGES.stepChannelTitle,
      description: ONBOARDING_MESSAGES.stepChannelDescription,
      done: progress.hasConnectedChannel,
      href: DASHBOARD_ROUTES.integrations,
      icon: PlugIcon,
    },
    {
      id: "ai",
      label: ONBOARDING_MESSAGES.stepAiTitle,
      description: ONBOARDING_MESSAGES.stepAiDescription,
      done: progress.hasAiEnabled,
      href: progress.connectedChannel
        ? buildAiAssistantHref({
            section: "assistant",
            channel: progress.connectedChannel,
          })
        : DASHBOARD_ROUTES.aiAssistant,
      icon: BotIcon,
    },
    {
      id: "knowledge",
      label: ONBOARDING_MESSAGES.stepKnowledgeTitle,
      description: ONBOARDING_MESSAGES.stepKnowledgeDescription,
      done: progress.hasKnowledgeEntry,
      href: DASHBOARD_ROUTES.knowledgeBase,
      icon: BookOpenIcon,
    },
  ];
}

export function countRemainingOptionalSteps(
  progress: OnboardingProgress,
): number {
  return buildOptionalOnboardingSteps(progress).filter((step) => !step.done)
    .length;
}
