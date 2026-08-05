import "server-only";

import { createHash } from "node:crypto";

import { incrementChannelAnalytics } from "@/lib/channel-analytics";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  generateFastAssistantReply,
  isChannelAutoReplyEnabled,
} from "@/services/auto-reply-pipeline.service";
import type { AutoReplyGenerationFailure } from "@/services/auto-reply-pipeline.service";
import { scheduleCrmOrchestration } from "@/services/ai-orchestration-queue.service";
import { scheduleDebouncedChannelAutoReply } from "@/services/ai-reply-queue.service";
import { maybeQueueImmediateHumanRequest } from "@/services/ai-human-request.service";
import { sendChannelAutoReplyText } from "@/services/channels/channel-auto-reply-send.service";
import { notifyAutoReplyError } from "@/services/auto-reply-inbox-status.service";
import { CHAT_MESSAGES } from "@/features/chats/constants";
import { retrieveKnowledgeForMessage } from "@/services/knowledge-retrieval.service";
import { scheduleInboundMessageEffects } from "@/services/inbound-message-effects.service";
import {
  cancelPendingFollowUpJobs,
  scheduleFollowUpJobsAfterAiReply,
} from "@/services/follow-up-agent.service";
import { updateConversationLastMessageFromInsert } from "@/services/conversation-last-message.service";
import {
  getMessageRepository,
  type ChannelMessageInsert,
  type ChannelMessageRow,
} from "@/repositories/message.repository";
import { getConversationRepository } from "@/repositories/conversation.repository";
import type { Database, MessagingChannel } from "@/types/database.types";
import { findContactForChannelWithIdentities } from "@/services/contact-channel-identity.service";
import { messagesAreLikelyDuplicates } from "@/utils/customer-facing-agent-summary";
import { withAiPipelineStep } from "@/lib/ai/tracing";

type MessagingDbClient = SupabaseClient<Database>;

export type { ChannelMessageInsert };
export type InsertedChannelMessageRow = ChannelMessageRow;

export async function findMessageByExternalId(
  admin: MessagingDbClient,
  channel: MessagingChannel,
  externalMessageId: string,
): Promise<InsertedChannelMessageRow | null> {
  return getMessageRepository(admin).findByExternalId(
    channel,
    externalMessageId,
  );
}

export async function insertChannelMessage(
  admin: MessagingDbClient,
  input: ChannelMessageInsert,
): Promise<InsertedChannelMessageRow> {
  const messageRepo = getMessageRepository(admin);

  if (input.externalMessageId) {
    const existing = await messageRepo.findByExternalId(
      input.channel,
      input.externalMessageId,
    );

    if (existing) {
      return existing;
    }
  }

  let inserted: ChannelMessageRow;

  try {
    inserted = await messageRepo.insert(input);
  } catch (error) {
    if (
      input.externalMessageId &&
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      const existing = await messageRepo.findByExternalId(
        input.channel,
        input.externalMessageId,
      );

      if (existing) {
        return existing;
      }
    }

    throw error;
  }

  await updateConversationLastMessageFromInsert(admin, {
    conversationId: input.conversationId,
    content: input.content,
    emailSubject: input.emailSubject,
    channel: input.channel,
    senderType: input.senderType,
    aiGenerated: input.aiGenerated,
    createdAt: inserted.sent_at ?? inserted.created_at,
  });

  return inserted;
}

export async function markOutboundMessageFailed(
  admin: MessagingDbClient,
  messageId: string,
): Promise<void> {
  await getMessageRepository(admin).setHiddenForBusiness(messageId);

  await admin
    .from("message_deliveries")
    .update({
      status: "failed",
      failed_at: new Date().toISOString(),
    })
    .eq("message_id", messageId);
}

const DELIVERY_RETRY_BASE_SECONDS = 30;

function buildAutoReplyDeliveryIdempotencyKey(input: {
  conversationId: string;
  clientMessage: string;
  replyText: string;
}): string {
  const digest = createHash("sha256")
    .update(input.conversationId)
    .update("\n")
    .update(input.clientMessage)
    .update("\n")
    .update(input.replyText)
    .digest("hex")
    .slice(0, 32);

  return `auto-reply:${input.conversationId}:${digest}`;
}

function computeDeliveryRetryAt(attemptCount: number): string {
  const delaySeconds =
    DELIVERY_RETRY_BASE_SECONDS * 2 ** Math.max(0, attemptCount - 1);

  return new Date(Date.now() + delaySeconds * 1000).toISOString();
}

export async function createOutboundMessageDelivery(
  admin: MessagingDbClient,
  input: {
    messageId: string;
    businessId: string;
    channel: MessagingChannel;
    conversationId?: string;
  },
): Promise<void> {
  let conversationId = input.conversationId ?? null;

  if (!conversationId) {
    conversationId =
      (await getMessageRepository(admin).findConversationId(input.messageId)) ??
      null;
  }

  const { error } = await admin.from("message_deliveries").upsert(
    {
      message_id: input.messageId,
      business_id: input.businessId,
      channel: input.channel,
      conversation_id: conversationId,
      status: "pending",
      attempt_count: 0,
      next_attempt_at: new Date().toISOString(),
    },
    { onConflict: "message_id", ignoreDuplicates: true },
  );

  if (error) {
    console.error("[message-delivery] create failed", error.message);
  }
}

export async function recordMessageDeliverySuccess(
  admin: MessagingDbClient,
  input: {
    messageId: string;
    providerMessageId?: string | null;
  },
): Promise<void> {
  const now = new Date().toISOString();

  await admin
    .from("message_deliveries")
    .update({
      status: "sent",
      provider_message_id: input.providerMessageId ?? null,
      sent_at: now,
      last_error: null,
    })
    .eq("message_id", input.messageId);
}

export async function recordMessageDeliveryFailure(
  admin: MessagingDbClient,
  input: {
    messageId: string;
    errorMessage: string;
    hideMessageOnExhausted?: boolean;
  },
): Promise<void> {
  const { data: delivery } = await admin
    .from("message_deliveries")
    .select("attempt_count, max_attempts")
    .eq("message_id", input.messageId)
    .maybeSingle();

  const attemptCount = (delivery?.attempt_count ?? 0) + 1;
  const maxAttempts = delivery?.max_attempts ?? 5;
  const exhausted = attemptCount >= maxAttempts;
  const now = new Date().toISOString();

  await admin
    .from("message_deliveries")
    .update({
      status: exhausted ? "failed" : "pending",
      attempt_count: attemptCount,
      next_attempt_at: exhausted ? now : computeDeliveryRetryAt(attemptCount),
      last_error: input.errorMessage.slice(0, 2000),
      failed_at: exhausted ? now : null,
    })
    .eq("message_id", input.messageId);

  if (exhausted && input.hideMessageOnExhausted !== false) {
    await getMessageRepository(admin).setHiddenForBusiness(input.messageId);
  }
}

export async function updateChannelMessageContent(
  admin: MessagingDbClient,
  input: {
    messageId: string;
    content: string;
  },
): Promise<void> {
  await getMessageRepository(admin).updateContent(
    input.messageId,
    input.content,
  );
}

export async function findContactForChannel(
  admin: MessagingDbClient,
  businessId: string,
  channel: MessagingChannel,
  identifier: string,
): Promise<{ id: string } | null> {
  return findContactForChannelWithIdentities(
    admin,
    businessId,
    channel,
    identifier,
  );
}

export async function resolveInboundConversation(
  admin: MessagingDbClient,
  businessId: string,
  contactId: string,
  channel: MessagingChannel,
): Promise<string | null> {
  return getConversationRepository(admin).resolveForInboundContact(
    businessId,
    contactId,
    channel,
  );
}

export async function incrementMessagingAnalytics(
  admin: MessagingDbClient,
  businessId: string,
  channel: MessagingChannel,
  updates: {
    totalMessages?: number;
    totalContacts?: number;
    aiReplies?: number;
  },
): Promise<void> {
  const { data: analytics } = await admin
    .from("analytics")
    .select("total_messages, total_contacts, ai_replies")
    .eq("business_id", businessId)
    .maybeSingle();

  await admin.from("analytics").upsert(
    {
      business_id: businessId,
      total_messages:
        (analytics?.total_messages ?? 0) + (updates.totalMessages ?? 0),
      total_contacts:
        (analytics?.total_contacts ?? 0) + (updates.totalContacts ?? 0),
      ai_replies: (analytics?.ai_replies ?? 0) + (updates.aiReplies ?? 0),
    },
    { onConflict: "business_id" },
  );

  await incrementChannelAnalytics(admin, businessId, channel, updates);
}

export function scheduleMessagingAnalyticsIncrement(
  admin: MessagingDbClient,
  businessId: string,
  channel: MessagingChannel,
  updates: {
    totalMessages?: number;
    totalContacts?: number;
    aiReplies?: number;
  },
): void {
  void incrementMessagingAnalytics(admin, businessId, channel, updates).catch(
    (error) => {
      console.error("[messaging] analytics increment failed", error);
    },
  );
}

export async function listKnowledgeEntriesForBusiness(
  admin: MessagingDbClient,
  businessId: string,
  query = "",
) {
  return retrieveKnowledgeForMessage({
    admin,
    businessId,
    query,
  });
}

function resolveAutoReplyErrorMessage(
  failure: AutoReplyGenerationFailure,
): { code: string; message: string } {
  if (failure.reason === "llm_failed") {
    const detail = failure.message?.trim() ?? "";
    const isQuota =
      /limit|quota|monthly/i.test(detail);

    return {
      code: failure.reason,
      message: isQuota
        ? CHAT_MESSAGES.autoReplyErrorQuota
        : detail || CHAT_MESSAGES.autoReplyErrorGeneric,
    };
  }

  if (failure.reason === "ai_disabled") {
    return {
      code: failure.reason,
      message: CHAT_MESSAGES.autoReplyErrorAiDisabled,
    };
  }

  return {
    code: failure.reason,
    message: CHAT_MESSAGES.autoReplyErrorSettings,
  };
}

export async function processChannelAutoReply(input: {
  admin: MessagingDbClient;
  businessId: string;
  channel: MessagingChannel;
  conversationId: string;
  clientMessage: string;
}): Promise<void> {
  const { admin, businessId, channel, conversationId, clientMessage } = input;

  const { isConversationAutoReplyBlocked } = await import(
    "@/services/conversation-auto-reply.service"
  );
  const handoffBlock = await isConversationAutoReplyBlocked(admin, {
    businessId,
    conversationId,
  });

  if (handoffBlock.blocked) {
    console.info(
      "[messaging] skipped auto-reply (human handoff)",
      JSON.stringify({
        businessId,
        conversationId,
        reason: handoffBlock.reason,
      }),
    );
    return;
  }

  const aiEnabled = await isChannelAutoReplyEnabled({
    admin,
    businessId,
    channel,
  });

  if (!aiEnabled) {
    await notifyAutoReplyError(conversationId, {
      errorCode: "ai_disabled",
      errorMessage: CHAT_MESSAGES.autoReplyErrorAiDisabled,
    });
    throw new Error("[ai_disabled] Auto-reply is off for this channel.");
  }

  const reply = await withAiPipelineStep(
    {
      step: "llm_fast",
      businessId,
      conversationId,
      channel,
    },
    () =>
      generateFastAssistantReply({
        admin,
        businessId,
        channel,
        conversationId,
        clientMessage,
      }),
  );

  if (!reply.success) {
    const error = resolveAutoReplyErrorMessage(reply);
    await notifyAutoReplyError(conversationId, {
      errorCode: error.code,
      errorMessage: error.message,
    });
    throw new Error(`[${error.code}] ${error.message}`);
  }

  if (reply.isFallback) {
    console.warn(
      "[messaging] delivered fallback auto-reply",
      JSON.stringify({
        businessId,
        channel,
        conversationId,
      }),
    );
    void notifyAutoReplyError(conversationId, {
      errorCode: "llm_fallback",
      errorMessage:
        "AI could not generate a reply. A default message was sent to the customer. Check API keys and monthly AI limits.",
    });
  }

  if (!reply.orchestrationCompleted && !reply.orchestrationAttempted) {
    await scheduleCrmOrchestration({
      businessId,
      channel,
      conversationId,
      clientMessage,
    }).catch((error) => {
      console.error("[messaging] failed to enqueue CRM orchestration", error);
    });
  }

  // Skip provider send when the same (or near-same) AI reply was just delivered —
  // protects against job retries after a successful channel send.
  try {
    const recentAiMessage = await getMessageRepository(admin).findLatestAiMessage(
      conversationId,
      businessId,
    );

    if (
      recentAiMessage?.content &&
      Date.now() - new Date(recentAiMessage.created_at).getTime() < 2 * 60 * 1000 &&
      messagesAreLikelyDuplicates(recentAiMessage.content, reply.text)
    ) {
      console.warn(
        "[messaging] skipped duplicate auto-reply send",
        JSON.stringify({ businessId, channel, conversationId }),
      );
      return;
    }
  } catch (error) {
    console.warn(
      "[messaging] duplicate-reply check failed; continuing with send",
      error instanceof Error ? error.message : "unknown",
    );
  }

  // Chat auto-replies are always text. Voice is reserved for phone calls only.
  let messageContent = reply.text;
  const sendResult = await sendChannelAutoReplyText({
    admin,
    businessId,
    channel,
    conversationId,
    text: reply.text,
    idempotencyKey: buildAutoReplyDeliveryIdempotencyKey({
      conversationId,
      clientMessage,
      replyText: reply.text,
    }),
  });

  if (!sendResult.success) {
    await notifyAutoReplyError(conversationId, {
      errorCode: "send_failed",
      errorMessage: CHAT_MESSAGES.autoReplyErrorSendFailed,
    });
    throw new Error("[send_failed] Unable to deliver auto-reply.");
  }

  if (sendResult.sentText) {
    messageContent = sendResult.sentText;
  }

  const insertedMessage = await insertChannelMessage(admin, {
    conversationId,
    channel,
    senderType: "ai",
    content: messageContent,
    emailSubject: sendResult.emailSubject,
    aiGenerated: true,
  });

  if (sendResult.providerMessageId) {
    await createOutboundMessageDelivery(admin, {
      messageId: insertedMessage.id,
      businessId,
      channel,
      conversationId,
    });
    await recordMessageDeliverySuccess(admin, {
      messageId: insertedMessage.id,
      providerMessageId: sendResult.providerMessageId,
    });
  }

  await incrementMessagingAnalytics(admin, businessId, channel, {
    totalMessages: 1,
    aiReplies: 1,
  });

  void scheduleFollowUpJobsAfterAiReply({
    admin,
    businessId,
    conversationId,
    channel,
    outboundContent: messageContent,
  }).catch((error) => {
    console.warn(
      "[messaging] schedule follow-up jobs failed",
      error instanceof Error ? error.message : "unknown",
    );
  });
}

export async function scheduleChannelAutoReply(input: {
  businessId: string;
  channel: MessagingChannel;
  conversationId: string;
  clientMessage: string;
}): Promise<void> {
  await scheduleDebouncedChannelAutoReply(input);
}

export async function scheduleInboundMessageProcessing(input: {
  admin: MessagingDbClient;
  businessId: string;
  channel: MessagingChannel;
  conversationId: string;
  clientMessage: string;
}): Promise<void> {
  scheduleInboundMessageEffects({
    admin: input.admin,
    businessId: input.businessId,
    channel: input.channel,
    conversationId: input.conversationId,
    clientMessage: input.clientMessage,
  });

  void cancelPendingFollowUpJobs({
    admin: input.admin,
    businessId: input.businessId,
    conversationId: input.conversationId,
  }).catch((error) => {
    console.warn(
      "[messaging] cancel follow-up jobs failed",
      error instanceof Error ? error.message : "unknown",
    );
  });

  void maybeQueueImmediateHumanRequest({
    admin: input.admin,
    businessId: input.businessId,
    conversationId: input.conversationId,
    channel: input.channel,
    clientMessage: input.clientMessage,
  }).catch((error) => {
    console.error("[messaging] immediate human request failed", error);
  });

  // Await enqueue + drain scheduling so `after()` / QStash register while the
  // request is still alive. Do not await the LLM itself.
  await scheduleChannelAutoReply({
    businessId: input.businessId,
    channel: input.channel,
    conversationId: input.conversationId,
    clientMessage: input.clientMessage,
  });
}
