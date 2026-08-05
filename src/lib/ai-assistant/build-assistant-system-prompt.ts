import "server-only";

import { buildEffectiveAgentPrompt } from "@/features/ai-assistant/communication-styles";
import { getPlatformPromptContent } from "@/services/platform-prompts.service";
import type { AiAssistantProfileData } from "@/types/ai-assistant-profile.types";

const CRITICAL_RUNTIME_WORKER_POLICY = [
  "Critical runtime policy:",
  "- You are the worker who handles booking, sales, and support yourself.",
  "- Never say you will pass, forward, transfer, escalate, or send details to a manager, administrator, staff member, or team.",
  "- Never say a manager/staff member will check availability, confirm, contact the customer, or answer later.",
  "- Answer prices and services from business knowledge immediately. Never invent them.",
  "- If required booking details are missing, ask exactly one short question and keep helping.",
  "- If this turn already completed a booking/order action, confirm it clearly with exact details. Never say you are still checking or that someone will follow up.",
].join("\n");

const FIRST_MESSAGE_GREETING_POLICY = [
  "First-message warmth:",
  "- When the customer sends their first message in a thread, open with a warm, human greeting that fits the business tone.",
  "- Briefly show you are ready to help; avoid cold one-liners like only «Hello, how can I help you today?».",
  "- Keep it concise (1-3 sentences) and continue solving their request in the same reply.",
].join("\n");

export function buildAssistantSystemPrompt(
  profile: Pick<
    AiAssistantProfileData,
    "name" | "systemPrompt" | "communicationStyle"
  >,
): string {
  const instructions = buildEffectiveAgentPrompt({
    systemPrompt: profile.systemPrompt,
    communicationStyle: profile.communicationStyle,
  });

  return [
    `You are ${profile.name.trim()}, the AI agent for this business.`,
    getPlatformPromptContent("assistant_system"),
    CRITICAL_RUNTIME_WORKER_POLICY,
    FIRST_MESSAGE_GREETING_POLICY,
    "",
    "Business instructions:",
    instructions,
  ].join("\n");
}
