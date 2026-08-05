import { z } from "zod";

import { isCommunicationStyleId } from "@/features/ai-assistant/communication-styles";
import {
  COLLECTION_NICHES,
  dataCollectionFieldsSchema,
  type CollectionNiche,
  type DataCollectionField,
} from "@/lib/ai/data-collection";
import { isValidAiReplyLanguage, REPLY_WAIT_MS_OPTIONS } from "@/lib/ai/languages";
import { agentScheduleSlotsSchema } from "@/types/ai-assistant-schedule.types";
import type { VoiceReplyMode } from "@/types/elevenlabs.types";
import type { AgentScheduleSlot } from "@/types/ai-assistant-schedule.types";
import type { AiIntensity } from "@/lib/ai/ai-intensity";

const replyWaitValues = REPLY_WAIT_MS_OPTIONS as [number, ...number[]];

export type CrmUpdateMode = "every_message" | "idle_5min" | "on_resolve";

export const CRM_UPDATE_MODES: CrmUpdateMode[] = [
  "every_message",
  "idle_5min",
  "on_resolve",
];

export function isCrmUpdateMode(value: unknown): value is CrmUpdateMode {
  return (
    value === "every_message" ||
    value === "idle_5min" ||
    value === "on_resolve"
  );
}

export const saveAiAssistantProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80),
  systemPrompt: z
    .string()
    .trim()
    .min(20, "Instructions must be at least 20 characters.")
    .max(4000),
  communicationStyle: z.string().refine(isCommunicationStyleId, {
    message: "Select a communication style.",
  }),
  language: z.string().refine(isValidAiReplyLanguage, {
    message: "Select a language.",
  }),
  replyWaitMs: z
    .number()
    .int()
    .refine((value) => replyWaitValues.includes(value), {
      message: "Select a reply wait time.",
    }),
  scheduleEnabled: z.boolean().default(false),
  scheduleTimezone: z.string().trim().min(1).max(64),
  scheduleSlots: agentScheduleSlotsSchema,
  crmUpdateMode: z
    .enum(["every_message", "idle_5min", "on_resolve"])
    .default("every_message"),
  aiIntensity: z.enum(["light", "full"]).default("light"),
  canReply: z.boolean().default(true),
  canCreateTask: z.boolean().default(true),
  canCreateDeal: z.boolean().default(true),
  canUpdateContact: z.boolean().default(true),
  canAddNote: z.boolean().default(true),
  canAddInternalNote: z.boolean().default(true),
  canCreateCalendarEvent: z.boolean().default(true),
  canRequestHuman: z.boolean().default(true),
  canNotifyOwner: z.boolean().default(true),
  canNotifyOnActions: z.boolean().default(true),
  canSummarizeActionsInChat: z.boolean().default(true),
  canSendProactiveMessage: z.boolean().default(true),
  collectionNiche: z.enum(COLLECTION_NICHES).default("generic"),
  dataCollectionFields: dataCollectionFieldsSchema.default([]),
}).refine((data) => !data.scheduleEnabled || data.scheduleSlots.length > 0, {
  message: "Add at least one time range when schedule is enabled.",
  path: ["scheduleSlots"],
});

export type SaveAiAssistantProfileInput = z.infer<
  typeof saveAiAssistantProfileSchema
>;

export type AiAssistantProfileData = {
  businessId: string;
  name: string;
  systemPrompt: string;
  communicationStyle: string;
  language: string;
  replyWaitMs: number;
  scheduleEnabled: boolean;
  scheduleTimezone: string;
  scheduleSlots: AgentScheduleSlot[];
  crmUpdateMode: CrmUpdateMode;
  aiIntensity: AiIntensity;
  canReply: boolean;
  canCreateTask: boolean;
  canCreateDeal: boolean;
  canUpdateContact: boolean;
  canAddNote: boolean;
  canAddInternalNote: boolean;
  canCreateCalendarEvent: boolean;
  canRequestHuman: boolean;
  canNotifyOwner: boolean;
  canNotifyOnActions: boolean;
  canSummarizeActionsInChat: boolean;
  canSendProactiveMessage: boolean;
  collectionNiche: CollectionNiche;
  dataCollectionFields: DataCollectionField[];
  voiceReplyEnabled: boolean;
  elevenlabsVoiceId: string | null;
  elevenlabsVoiceName: string | null;
  voiceReplyMode: VoiceReplyMode;
};
