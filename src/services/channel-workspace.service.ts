import "server-only";

import { revalidatePath } from "next/cache";

import { APP_ROUTES, DASHBOARD_ROUTES } from "@/constants/routes";
import {
  DEFAULT_AI_LANGUAGE,
  DEFAULT_AI_SYSTEM_PROMPT,
} from "@/features/business/constants";
import type { AiAgentChannelId, IntegrationChannelId, MessagingIntegrationChannelId } from "@/features/integrations/constants";
import { MESSAGING_INTEGRATION_CHANNELS } from "@/features/integrations/constants";
import {
  buildIntegrationChannelStatuses,
  isChannelConnectedForWorkspace,
} from "@/features/integrations/channel-status";
import { getDefaultGeminiModel, hasGeminiEnv, hasSupabaseEnv } from "@/lib/env";
import {
  buildDefaultChannelAiBehavior,
  mapChannelAiBehaviorRow,
} from "@/lib/ai/channel-behavior";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/services/auth.service";
import { getPrimaryBusiness } from "@/services/business.service";
import {
  getProviderAvailability,
  isProviderConfigured,
} from "@/services/llm.service";
import { generateFastAssistantReply } from "@/services/auto-reply-pipeline.service";
import { getGmailConnection } from "@/services/gmail-integration.service";
import { getOutlookConnection } from "@/services/outlook-integration.service";
import { getGoogleCalendarConnection } from "@/services/google-calendar.service";
import { getTelegramConnection } from "@/services/telegram.service";
import { getTelegramUserConnection } from "@/services/telegram-user.service";
import { getWebsiteFormConnection } from "@/services/website-forms.service";
import { getWebsiteChatConnection } from "@/services/website-chat.service";
import { getWebsiteKnowledgeSync } from "@/services/website-knowledge.service";
import { getInternetPhoneConnection } from "@/services/internet-phone.service";
import { getVoiceAgentSettings, getVoiceConnection } from "@/services/voice-agent.service";
import { getWhatsAppConnection } from "@/services/whatsapp.service";
import { getWhatsAppWebConnection } from "@/services/whatsapp-web.service";
import type { Database, MessagingChannel } from "@/types/database.types";
import type {
  ChannelAiSettingsData,
  ChannelAnalyticsData,
  ChannelContactsData,
  ChannelWorkspaceSummary,
  SaveChannelAiBehaviorInput,
  SaveChannelAiSettingsInput,
  TestChannelAiReplyInput,
} from "@/types/channel-workspace.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  saveChannelAiBehaviorSchema,
  saveChannelAiSettingsSchema,
  testChannelAiReplySchema,
} from "@/types/channel-workspace.types";
import {
  buildLastSevenDaysActivity,
  calculateConversionRate,
} from "@/utils/dashboard";

export async function isAgentReplyEnabled(
  businessId: string,
  db?: SupabaseClient<Database>,
): Promise<boolean> {
  if (!hasSupabaseEnv()) {
    return false;
  }

  const supabase = db ?? createAdminClient();
  const { data } = await supabase
    .from("ai_assistant_profile")
    .select("can_reply")
    .eq("business_id", businessId)
    .maybeSingle();

  // No assistant profile yet = the user hasn't set up / turned on the AI.
  // Default OFF so connecting a channel never auto-enables auto-reply; the AI
  // only starts replying once the user explicitly enables it.
  if (!data) {
    return false;
  }

  return data.can_reply;
}

export async function enableAiForChannels(
  businessId: string,
  channels: MessagingIntegrationChannelId[],
  db?: SupabaseClient<Database>,
): Promise<void> {
  if (!hasSupabaseEnv() || channels.length === 0) {
    return;
  }

  const supabase = db ?? (await createClient());

  for (const channel of channels) {
    await ensureChannelAiSettings(supabase, businessId, channel);
  }

  await supabase
    .from("ai_settings")
    .update({ ai_enabled: true })
    .eq("business_id", businessId)
    .in("channel", channels);
}

/**
 * No-op by product decision: AI auto-reply is strictly manual per channel.
 * Connecting a channel must NEVER auto-enable the assistant — the user turns AI
 * on explicitly in AI settings (which calls {@link enableAiForChannels}).
 * Kept as a stable call site so connect flows don't need to change.
 */
export async function enableChannelAiIfAgentActive(
  _businessId: string,
  _channel: MessagingIntegrationChannelId,
  _db?: SupabaseClient<Database>,
): Promise<void> {
  // Intentionally does nothing.
}

/**
 * Permanently delete every conversation + message for a channel when it is
 * disconnected, so nothing lingers on the platform after disconnect. This only
 * touches OrzuX data (never the external Gmail/WhatsApp/Telegram account).
 *
 * Deleting the conversations cascades (via FK ON DELETE CASCADE) to messages,
 * attachments, deliveries, reads, AI jobs and conversation-scoped notifications.
 * Contacts and CRM records (deals/tasks) are intentionally kept.
 */
export async function purgeChannelConversations(
  businessId: string,
  channel: MessagingChannel,
  db?: SupabaseClient<Database>,
): Promise<void> {
  if (!hasSupabaseEnv()) {
    return;
  }

  // Always use an admin (service-role) client so the cascade delete is not
  // blocked by RLS, regardless of which caller invokes this.
  const client = db ?? createAdminClient();

  const { error } = await client
    .from("conversations")
    .delete()
    .eq("business_id", businessId)
    .eq("channel", channel);

  if (error) {
    console.error(
      "[channel-workspace] purge channel conversations failed",
      JSON.stringify({ businessId, channel, message: error.message }),
    );
  }
}

export async function disableAiForAllChannels(
  businessId: string,
): Promise<void> {
  if (!hasSupabaseEnv()) {
    return;
  }

  const supabase = await createClient();

  await supabase
    .from("ai_settings")
    .update({ ai_enabled: false })
    .eq("business_id", businessId)
    .in("channel", [...MESSAGING_INTEGRATION_CHANNELS]);
}

export async function syncChannelAiEnabledAfterAgentChange(
  businessId: string,
  channels: MessagingIntegrationChannelId[],
): Promise<void> {
  void businessId;
  void channels;
  // Single-agent mode stores channel enablement directly in ai_settings.
}

function revalidateChannelWorkspacePaths(channel: AiAgentChannelId): void {
  revalidatePath(DASHBOARD_ROUTES.aiAssistant);
  revalidatePath(DASHBOARD_ROUTES.aiAssistantChannels);
  revalidatePath(DASHBOARD_ROUTES.aiManager);
  revalidatePath(DASHBOARD_ROUTES.analytics);
  revalidatePath(DASHBOARD_ROUTES.onboarding);
  revalidatePath(`${DASHBOARD_ROUTES.integrations}/${channel}`);
  revalidatePath(DASHBOARD_ROUTES.integrations);
  revalidatePath(DASHBOARD_ROUTES.chats);
  revalidatePath(APP_ROUTES.dashboard);
}

async function getOwnedBusinessId(): Promise<string | null> {
  const user = await requireUser();
  const business = await getPrimaryBusiness(user.id);
  return business?.id ?? null;
}

async function ensureChannelAiSettings(
  supabase: SupabaseClient<Database>,
  businessId: string,
  channel: AiAgentChannelId,
) {
  const { data } = await supabase
    .from("ai_settings")
    .select("id")
    .eq("business_id", businessId)
    .eq("channel", channel)
    .maybeSingle();

  if (data) {
    return;
  }

  await supabase.from("ai_settings").insert({
    business_id: businessId,
    channel,
    provider: "gemini",
    model: getDefaultGeminiModel(),
    language: DEFAULT_AI_LANGUAGE,
    system_prompt: DEFAULT_AI_SYSTEM_PROMPT,
    ai_enabled: false,
  });
}

/**
 * Per-channel provider/model UI is intentionally unwired; inbound replies use the
 * platform LLM. provider/model/language/systemPrompt below are display-only leftovers
 * for ChannelAiSettingsData compatibility — ai_enabled + optional behavior overrides
 * drive channel behavior.
 */
export async function getChannelAiSettingsForBusiness(
  businessId: string,
  channel: AiAgentChannelId,
  isChannelConnected: boolean,
): Promise<ChannelAiSettingsData> {
  const defaultModel = getDefaultGeminiModel();
  const providerAvailability = getProviderAvailability();
  const defaultBehavior = buildDefaultChannelAiBehavior();

  if (!hasSupabaseEnv()) {
    return {
      hasBusiness: true,
      channel,
      aiEnabled: false,
      provider: "gemini",
      model: defaultModel,
      language: DEFAULT_AI_LANGUAGE,
      systemPrompt: DEFAULT_AI_SYSTEM_PROMPT,
      isConfigured: false,
      geminiConfigured: hasGeminiEnv(),
      providerAvailability,
      isChannelConnected,
      defaultModel,
      behavior: defaultBehavior,
    };
  }

  const supabase = await createClient();
  await ensureChannelAiSettings(supabase, businessId, channel);

  const [{ data }, profileResult] = await Promise.all([
    supabase
      .from("ai_settings")
      .select(
        "ai_enabled, channel_overrides_enabled, reply_wait_ms, can_create_task, can_create_deal, can_update_contact, can_add_note, can_add_internal_note, can_create_calendar_event, can_request_human, can_notify_owner, can_notify_on_actions, can_summarize_actions_in_chat, can_send_proactive_message",
      )
      .eq("business_id", businessId)
      .eq("channel", channel)
      .maybeSingle(),
    supabase
      .from("ai_assistant_profile")
      .select(
        "reply_wait_ms, can_create_task, can_create_deal, can_update_contact, can_add_note, can_add_internal_note, can_create_calendar_event, can_request_human, can_notify_owner, can_notify_on_actions, can_summarize_actions_in_chat, can_send_proactive_message",
      )
      .eq("business_id", businessId)
      .maybeSingle(),
  ]);

  const profile = profileResult.data;
  const profileFallback = buildDefaultChannelAiBehavior(
    profile?.reply_wait_ms ?? defaultBehavior.replyWaitMs,
  );
  if (profile) {
    profileFallback.canCreateTask = profile.can_create_task ?? true;
    profileFallback.canCreateDeal = profile.can_create_deal ?? true;
    profileFallback.canUpdateContact = profile.can_update_contact ?? true;
    profileFallback.canAddNote = profile.can_add_note ?? true;
    profileFallback.canAddInternalNote = profile.can_add_internal_note ?? true;
    profileFallback.canCreateCalendarEvent =
      profile.can_create_calendar_event ?? true;
    profileFallback.canRequestHuman = profile.can_request_human ?? true;
    profileFallback.canNotifyOwner = profile.can_notify_owner ?? true;
    profileFallback.canNotifyOnActions = profile.can_notify_on_actions ?? true;
    profileFallback.canSummarizeActionsInChat =
      profile.can_summarize_actions_in_chat ?? true;
    profileFallback.canSendProactiveMessage =
      profile.can_send_proactive_message ?? true;
  }

  return {
    hasBusiness: true,
    channel,
    aiEnabled: data?.ai_enabled ?? false,
    provider: "gemini",
    model: defaultModel,
    language: DEFAULT_AI_LANGUAGE,
    systemPrompt: DEFAULT_AI_SYSTEM_PROMPT,
    isConfigured: Boolean(data),
    geminiConfigured: hasGeminiEnv(),
    providerAvailability,
    isChannelConnected,
    defaultModel,
    behavior: mapChannelAiBehaviorRow(data, profileFallback),
  };
}

export async function syncChannelAnalytics(
  businessId: string,
  channel: MessagingIntegrationChannelId,
): Promise<{
  totalMessages: number;
  totalContacts: number;
  aiReplies: number;
}> {
  const admin = createAdminClient();

  const { count: totalContacts } = await admin
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("channel", channel);

  const { data: conversations } = await admin
    .from("conversations")
    .select("id")
    .eq("business_id", businessId)
    .eq("channel", channel);

  const conversationIds = conversations?.map((row) => row.id) ?? [];

  let totalMessages = 0;
  let aiReplies = 0;

  if (conversationIds.length > 0) {
    const { count: messageCount } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", conversationIds);

    const { count: aiCount } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", conversationIds)
      .eq("ai_generated", true);

    totalMessages = messageCount ?? 0;
    aiReplies = aiCount ?? 0;
  }

  const payload = {
    business_id: businessId,
    channel,
    total_messages: totalMessages,
    total_contacts: totalContacts ?? 0,
    ai_replies: aiReplies,
    updated_at: new Date().toISOString(),
  };

  await admin.from("channel_analytics").upsert(payload, {
    onConflict: "business_id,channel",
  });

  return {
    totalMessages,
    totalContacts: totalContacts ?? 0,
    aiReplies,
  };
}

export async function getChannelConnectionStatuses(businessId: string) {
  const [
    whatsapp,
    whatsappWeb,
    telegram,
    telegramUser,
    websiteForms,
    websiteChat,
    websiteKnowledge,
    voice,
    voiceSettings,
    internetPhone,
    googleCalendar,
    gmail,
    outlook,
  ] = await Promise.all([
    getWhatsAppConnection(businessId),
    getWhatsAppWebConnection(businessId),
    getTelegramConnection(businessId),
    getTelegramUserConnection(businessId),
    getWebsiteFormConnection(businessId),
    getWebsiteChatConnection(businessId),
    getWebsiteKnowledgeSync(businessId),
    getVoiceConnection(businessId),
    getVoiceAgentSettings(businessId),
    getInternetPhoneConnection(businessId),
    getGoogleCalendarConnection(businessId),
    getGmailConnection(businessId),
    getOutlookConnection(businessId),
  ]);

  return buildIntegrationChannelStatuses({
    whatsappConnection: whatsapp,
    whatsappWebConnection: whatsappWeb,
    telegramConnection: telegram,
    telegramUserConnection: telegramUser,
    websiteFormConnection: websiteForms,
    websiteChatConnection: websiteChat,
    websiteKnowledgeSync: websiteKnowledge,
    voiceConnection: voice,
    voiceSmsEnabled: voiceSettings?.smsEnabled ?? false,
    internetPhoneConnection: internetPhone,
    googleCalendarConnection: googleCalendar,
    gmailConnection: gmail,
    outlookConnection: outlook,
  });
}

export async function getChannelWorkspaceSummary(
  businessId: string,
  channel: MessagingIntegrationChannelId,
): Promise<ChannelWorkspaceSummary> {
  if (!hasSupabaseEnv()) {
    return { contactsCount: 0, aiEnabled: false, totalMessages: 0 };
  }

  const supabase = await createClient();

  const [contactsResult, aiResult, metrics] = await Promise.all([
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("channel", channel),
    supabase
      .from("ai_settings")
      .select("ai_enabled")
      .eq("business_id", businessId)
      .eq("channel", channel)
      .maybeSingle(),
    syncChannelAnalytics(businessId, channel),
  ]);

  return {
    contactsCount: contactsResult.count ?? 0,
    aiEnabled: aiResult.data?.ai_enabled ?? false,
    totalMessages: metrics.totalMessages,
  };
}

export async function getChannelContacts(
  channel: MessagingIntegrationChannelId,
): Promise<ChannelContactsData> {
  const businessId = await getOwnedBusinessId();

  if (!businessId || !hasSupabaseEnv()) {
    return {
      hasBusiness: false,
      channel,
      contacts: [],
      total: 0,
    };
  }

  const supabase = await createClient();
  const { data, count } = await supabase
    .from("contacts")
    .select("id, name, phone_number, last_message_at")
    .eq("business_id", businessId)
    .eq("channel", channel)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(50);

  return {
    hasBusiness: true,
    channel,
    total: count ?? data?.length ?? 0,
    contacts:
      data?.map((row) => ({
        id: row.id,
        name: row.name,
        identifier: row.phone_number,
        lastMessageAt: row.last_message_at,
      })) ?? [],
  };
}

export async function getChannelAiSettings(
  channel: AiAgentChannelId,
): Promise<ChannelAiSettingsData> {
  const businessId = await getOwnedBusinessId();

  if (!businessId || !hasSupabaseEnv()) {
    return {
      hasBusiness: false,
      channel,
      aiEnabled: false,
      provider: "gemini",
      model: getDefaultGeminiModel(),
      language: DEFAULT_AI_LANGUAGE,
      systemPrompt: DEFAULT_AI_SYSTEM_PROMPT,
      isConfigured: false,
      geminiConfigured: hasGeminiEnv(),
      providerAvailability: getProviderAvailability(),
      isChannelConnected: false,
      defaultModel: getDefaultGeminiModel(),
      behavior: buildDefaultChannelAiBehavior(),
    };
  }

  const statuses = await getChannelConnectionStatuses(businessId);

  return getChannelAiSettingsForBusiness(
    businessId,
    channel,
    isChannelConnectedForWorkspace(channel, statuses),
  );
}

export async function saveChannelAiSettings(
  input: SaveChannelAiSettingsInput,
): Promise<{ success: boolean; message?: string }> {
  const parsed = saveChannelAiSettingsSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid settings.",
    };
  }

  const businessId = await getOwnedBusinessId();

  if (!businessId || !hasSupabaseEnv()) {
    return { success: false, message: "Configuration missing." };
  }

  const supabase = await createClient();
  await ensureChannelAiSettings(supabase, businessId, parsed.data.channel);

  const { error } = await supabase
    .from("ai_settings")
    .update({
      ai_enabled: parsed.data.aiEnabled,
    })
    .eq("business_id", businessId)
    .eq("channel", parsed.data.channel);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidateChannelWorkspacePaths(parsed.data.channel);

  return { success: true };
}

export async function saveChannelAiBehavior(
  input: SaveChannelAiBehaviorInput,
): Promise<{ success: boolean; message?: string }> {
  const parsed = saveChannelAiBehaviorSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid settings.",
    };
  }

  const businessId = await getOwnedBusinessId();

  if (!businessId || !hasSupabaseEnv()) {
    return { success: false, message: "Configuration missing." };
  }

  const supabase = await createClient();
  await ensureChannelAiSettings(supabase, businessId, parsed.data.channel);

  const { error } = await supabase
    .from("ai_settings")
    .update({
      channel_overrides_enabled: true,
      reply_wait_ms: parsed.data.replyWaitMs,
      can_create_task: parsed.data.canCreateTask,
      can_create_deal: parsed.data.canCreateDeal,
      can_update_contact: parsed.data.canUpdateContact,
      can_add_note: parsed.data.canAddNote,
      can_add_internal_note: parsed.data.canAddInternalNote,
      can_create_calendar_event: parsed.data.canCreateCalendarEvent,
      can_request_human: parsed.data.canRequestHuman,
      can_notify_owner: parsed.data.canNotifyOwner,
      can_notify_on_actions: parsed.data.canNotifyOnActions,
      can_summarize_actions_in_chat: parsed.data.canSummarizeActionsInChat,
      can_send_proactive_message: parsed.data.canSendProactiveMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("business_id", businessId)
    .eq("channel", parsed.data.channel);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath(DASHBOARD_ROUTES.aiAssistant);
  revalidatePath(DASHBOARD_ROUTES.aiAssistantChannels);
  revalidatePath(
    DASHBOARD_ROUTES.aiAssistantChannelSettings(parsed.data.channel),
  );

  return { success: true };
}

export async function testChannelAiReply(
  input: TestChannelAiReplyInput,
): Promise<
  | { success: true; reply: string; matchedAgentName: string | null }
  | { success: false; message: string }
> {
  const parsed = testChannelAiReplySchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid test message.",
    };
  }

  const businessId = await getOwnedBusinessId();

  if (!businessId || !hasSupabaseEnv()) {
    return { success: false, message: "Configuration missing." };
  }

  const admin = createAdminClient();

  const reply = await generateFastAssistantReply({
    admin,
    businessId,
    channel: parsed.data.channel,
    clientMessage: parsed.data.testMessage,
    conversationHistory: [],
    requireAiEnabled: false,
    skipWorkerActions: true,
  });

  if (!reply.success) {
    if (reply.reason === "settings_missing") {
      return {
        success: false,
        message: "Connect this channel in Integrations first.",
      };
    }

    return {
      success: false,
      message: reply.message ?? "Unable to generate test reply.",
    };
  }

  if (!isProviderConfigured(reply.provider)) {
    return {
      success: false,
      message: `${reply.provider} API is not configured for this environment.`,
    };
  }

  return {
    success: true,
    reply: reply.text,
    matchedAgentName: reply.matchedAgentName,
  };
}

export async function getChannelAnalytics(
  channel: MessagingIntegrationChannelId,
): Promise<ChannelAnalyticsData> {
  const businessId = await getOwnedBusinessId();

  if (!businessId || !hasSupabaseEnv()) {
    return emptyChannelAnalytics(channel);
  }

  const admin = createAdminClient();
  const metrics = await syncChannelAnalytics(businessId, channel);

  const { count: activeConversations } = await admin
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("channel", channel)
    .eq("status", "active");

  const { data: conversations } = await admin
    .from("conversations")
    .select("id, contact:contacts(name)")
    .eq("business_id", businessId)
    .eq("channel", channel);

  const conversationIds = conversations?.map((row) => row.id) ?? [];
  const contactNameByConversation = new Map<string, string>();

  for (const row of conversations ?? []) {
    const contact = Array.isArray(row.contact) ? row.contact[0] : row.contact;
    contactNameByConversation.set(
      row.id,
      contact?.name?.trim() || "Customer",
    );
  }

  let activity: ChannelAnalyticsData["activity"] = [];
  let recentMessages: ChannelAnalyticsData["recentMessages"] = [];

  if (conversationIds.length > 0) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [{ data: activityRows }, { data: recentRows }] = await Promise.all([
      admin
        .from("messages")
        .select("created_at")
        .in("conversation_id", conversationIds)
        .gte("created_at", sevenDaysAgo.toISOString()),
      admin
        .from("messages")
        .select("id, conversation_id, sender_type, content, created_at")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

    activity = buildLastSevenDaysActivity(
      activityRows?.map((message) => message.created_at) ?? [],
    );

    recentMessages =
      recentRows?.map((message) => ({
        id: message.id,
        preview: message.content.trim().slice(0, 120),
        senderType: message.sender_type,
        createdAt: message.created_at,
        contactName:
          contactNameByConversation.get(message.conversation_id) ?? "Customer",
      })) ?? [];
  } else {
    activity = buildLastSevenDaysActivity([]);
  }

  const manualReplies = Math.max(
    0,
    metrics.totalMessages - metrics.aiReplies,
  );

  return {
    hasBusiness: true,
    channel,
    totalMessages: metrics.totalMessages,
    totalContacts: metrics.totalContacts,
    aiReplies: metrics.aiReplies,
    manualReplies,
    activeConversations: activeConversations ?? 0,
    conversionRate: calculateConversionRate(
      metrics.aiReplies,
      metrics.totalMessages,
    ),
    activity,
    recentMessages,
  };
}

function emptyChannelAnalytics(
  channel: MessagingIntegrationChannelId,
): ChannelAnalyticsData {
  return {
    hasBusiness: false,
    channel,
    totalMessages: 0,
    totalContacts: 0,
    aiReplies: 0,
    manualReplies: 0,
    activeConversations: 0,
    conversionRate: 0,
    activity: buildLastSevenDaysActivity([]),
    recentMessages: [],
  };
}

export async function isChannelWorkspaceReady(
  businessId: string,
  channel: IntegrationChannelId,
): Promise<boolean> {
  const statuses = await getChannelConnectionStatuses(businessId);
  return isChannelConnectedForWorkspace(channel, statuses);
}

export async function setMessagingChannelsAiEnabled(
  enabled: boolean,
): Promise<{ success: boolean; message?: string }> {
  const businessId = await getOwnedBusinessId();

  if (!businessId || !hasSupabaseEnv()) {
    return { success: false, message: "Configuration missing." };
  }

  const supabase = await createClient();

  for (const channel of MESSAGING_INTEGRATION_CHANNELS) {
    await ensureChannelAiSettings(supabase, businessId, channel);
  }

  const { error } = await supabase
    .from("ai_settings")
    .update({ ai_enabled: enabled })
    .eq("business_id", businessId)
    .in("channel", [...MESSAGING_INTEGRATION_CHANNELS]);

  if (error) {
    return { success: false, message: error.message };
  }

  for (const channel of MESSAGING_INTEGRATION_CHANNELS) {
    revalidateChannelWorkspacePaths(channel);
  }

  return { success: true };
}

export async function updateChannelAiEnabled(
  channel: AiAgentChannelId,
  enabled: boolean,
): Promise<{ success: boolean; message?: string }> {
  const businessId = await getOwnedBusinessId();

  if (!businessId || !hasSupabaseEnv()) {
    return { success: false, message: "Configuration missing." };
  }

  const supabase = await createClient();
  await ensureChannelAiSettings(supabase, businessId, channel);

  const { error } = await supabase
    .from("ai_settings")
    .update({ ai_enabled: enabled })
    .eq("business_id", businessId)
    .eq("channel", channel);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidateChannelWorkspacePaths(channel);

  return { success: true };
}
