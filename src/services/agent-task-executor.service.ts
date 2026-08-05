import "server-only";

import { revalidatePath } from "next/cache";
import { getMessageRepository } from "@/repositories/message.repository";
import type { SupabaseClient } from "@supabase/supabase-js";

import { DASHBOARD_ROUTES } from "@/constants/routes";
import {
  AGENT_TOOL_BY_NAME,
  AGENT_TOOL_NAMES,
  logAgentToolAudit,
} from "@/lib/ai/tools";
import {
  messagesAreLikelyDuplicates,
  sanitizeCustomerFacingSummary,
} from "@/utils/customer-facing-agent-summary";

import type { RoutableAiAgent } from "@/utils/ai-agent-routing";
import {
  buildCrmActionIdempotencyKey,
  buildExecutorPlanIdempotencyKey,
  hasCrmIdempotencyKey,
  recordCrmIdempotencyKey,
} from "@/lib/crm/executor-idempotency";
import { formatSkippedDuplicate } from "@/lib/ai/agent-run-actions";
import type {
  AgentExecutorResult,
  ExecutorAction,
  ExecutorContactUpdates,
  ExecutorPlan,
} from "@/types/agent-executor.types";
import type { ContactCustomFields, PipelineStage } from "@/types/contact.types";
import { PIPELINE_STAGES } from "@/types/contact.types";
import type { Database, MessagingChannel } from "@/types/database.types";
import type { AgentRoutingMethod } from "@/types/intent-router.types";
import {
  createAdditionalContactId,
  parseAdditionalContacts,
  type AdditionalContactEntry,
} from "@/utils/contact-additional-contacts";
import { createAiCalendarEventNotification } from "@/services/business-notifications.service";
import { createAiCalendarBooking } from "@/services/ai-calendar-booking.service";
import { createAiHumanRequest } from "@/services/ai-human-request.service";
import { scheduleOrchestratorFollowUp } from "@/services/follow-up-agent.service";
import {
  createCalendarTaskForBusiness,
  deleteCalendarEventForBusiness,
  updateCalendarEventForBusiness,
} from "@/services/calendar-events.service";
import {
  findUpcomingEventsForContact,
  scheduleEventReminderJob,
} from "@/services/event-reminder.service";
import { sendChannelAutoReplyText } from "@/services/channels/channel-auto-reply-send.service";
import { insertChannelMessage } from "@/services/messaging.service";
import {
  computeCollectionGaps,
  mapCollectedAnswersToContactUpdates,
  mergeCollectionAnswersIntoCustomFields,
  type DataCollectionField,
} from "@/lib/ai/data-collection";
import { getConversationRepository } from "@/repositories/conversation.repository";
import { canonicalPhoneNumber, phoneDigitsOnly } from "@/utils/whatsapp";

type MessagingDbClient = SupabaseClient<Database>;

export type ContactSnapshot = {
  id: string;
  name: string;
  phoneNumber: string;
  email: string | null;
  tags: string[];
  customFields: ContactCustomFields;
  pipelineStage: PipelineStage;
  dealValue: number | null;
  expectedCloseDate: string | null;
  aiSummary: string | null;
};

const GENERIC_CONTACT_NAMES = new Set([
  "customer",
  "client",
  "guest",
  "unknown",
  "user",
  "contact",
]);

function calendarEventBelongsToContact(
  event: { customer_name: string; customer_email: string },
  contact: ContactSnapshot,
): boolean {
  const email = contact.email?.trim().toLowerCase() || "";
  const name = contact.name.trim().toLowerCase();
  const rowEmail = (event.customer_email ?? "").trim().toLowerCase();
  const rowName = (event.customer_name ?? "").trim().toLowerCase();

  if (email && rowEmail && rowEmail === email) {
    return true;
  }

  if (
    name &&
    rowName &&
    (rowName === name || rowName.includes(name) || name.includes(rowName))
  ) {
    return true;
  }

  return false;
}

function parseCustomFields(value: unknown): ContactCustomFields {
  if (!value || typeof value !== "object") {
    return {};
  }

  const record = value as Record<string, unknown>;
  const additionalContacts = parseAdditionalContacts(record.additionalContacts);
  const collectionRaw = record.collection;
  const collection: Record<string, string> = {};

  if (collectionRaw && typeof collectionRaw === "object" && !Array.isArray(collectionRaw)) {
    for (const [key, entry] of Object.entries(
      collectionRaw as Record<string, unknown>,
    )) {
      if (typeof entry === "string" && entry.trim()) {
        collection[key] = entry.trim();
      }
    }
  }

  return {
    company:
      typeof record.company === "string" && record.company.trim()
        ? record.company.trim()
        : undefined,
    notes:
      typeof record.notes === "string" && record.notes.trim()
        ? record.notes.trim()
        : undefined,
    location:
      typeof record.location === "string" && record.location.trim()
        ? record.location.trim()
        : undefined,
    additionalContacts:
      additionalContacts.length > 0 ? additionalContacts : undefined,
    collection: Object.keys(collection).length > 0 ? collection : undefined,
  };
}

function phoneDigitsMatch(a: string, b: string): boolean {
  const left = phoneDigitsOnly(a);
  const right = phoneDigitsOnly(b);

  return Boolean(left && right && left === right);
}

function mergeAdditionalPhone(
  existing: AdditionalContactEntry[] | undefined,
  phone: string,
  label = "Alternate",
): AdditionalContactEntry[] {
  const normalized = canonicalPhoneNumber(phone) || phone.trim();
  const entries = [...(existing ?? [])];

  if (
    entries.some(
      (entry) =>
        entry.type === "phone" && phoneDigitsMatch(entry.value, normalized),
    )
  ) {
    return entries;
  }

  entries.push({
    id: createAdditionalContactId(),
    type: "phone",
    value: normalized,
    label,
  });

  return entries.slice(0, 20);
}

function isPlaceholderContactName(name: string, phoneNumber: string): boolean {
  const trimmed = name.trim().toLowerCase();

  if (!trimmed || GENERIC_CONTACT_NAMES.has(trimmed)) {
    return true;
  }

  const nameDigits = trimmed.replace(/\D/g, "");
  const phoneDigits = phoneNumber.replace(/\D/g, "");

  return Boolean(nameDigits && phoneDigits && nameDigits === phoneDigits);
}

function parsePipelineStage(value: string | null | undefined): PipelineStage {
  if (PIPELINE_STAGES.includes(value as PipelineStage)) {
    return value as PipelineStage;
  }

  return "new";
}

function mapDealStatus(stage: PipelineStage): string {
  if (stage === "won") {
    return "won";
  }

  if (stage === "lost") {
    return "lost";
  }

  return "open";
}

function getAllowedActionTypes(): Set<ExecutorAction["type"]> {
  return new Set(
    AGENT_TOOL_NAMES.filter(
      (name) => !AGENT_TOOL_BY_NAME.get(name)?.runsWithoutContact,
    ),
  );
}

const GENERIC_DEAL_TITLES = new Set([
  "deal",
  "new deal",
  "sale",
  "order",
  "quote",
  "inquiry",
]);

export async function loadContactSnapshot(
  admin: MessagingDbClient,
  businessId: string,
  contactId: string,
): Promise<ContactSnapshot | null> {
  const { data } = await admin
    .from("contacts")
    .select(
      "id, name, phone_number, email, tags, custom_fields, pipeline_stage, deal_value, expected_close_date, ai_summary",
    )
    .eq("id", contactId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    phoneNumber: data.phone_number,
    email: data.email,
    tags: data.tags ?? [],
    customFields: parseCustomFields(data.custom_fields),
    pipelineStage: parsePipelineStage(data.pipeline_stage),
    dealValue: data.deal_value,
    expectedCloseDate: data.expected_close_date,
    aiSummary: data.ai_summary?.trim() || null,
  };
}

async function syncPrimaryDeal(
  admin: MessagingDbClient,
  businessId: string,
  contactId: string,
  input: {
    dealValue: number | null;
    pipelineStage: PipelineStage;
    expectedCloseDate: string | null;
  },
): Promise<void> {
  const { data: primaryDeal } = await admin
    .from("crm_deals")
    .select("id")
    .eq("business_id", businessId)
    .eq("contact_id", contactId)
    .eq("is_primary", true)
    .maybeSingle();

  const payload = {
    value: input.dealValue,
    stage: input.pipelineStage,
    expected_close_date: input.expectedCloseDate,
    status: mapDealStatus(input.pipelineStage),
  };

  if (primaryDeal?.id) {
    await admin
      .from("crm_deals")
      .update(payload)
      .eq("id", primaryDeal.id)
      .eq("business_id", businessId);
    return;
  }

  if (input.dealValue === null && input.pipelineStage === "new") {
    return;
  }

  await admin.from("crm_deals").insert({
    business_id: businessId,
    contact_id: contactId,
    title: "Primary deal",
    is_primary: true,
    ...payload,
  });
}

async function applyContactUpdates(
  admin: MessagingDbClient,
  businessId: string,
  contact: ContactSnapshot,
  updates: ExecutorContactUpdates,
  idempotencyContext: {
    conversationId?: string | null;
    clientMessage: string;
  },
): Promise<string[]> {
  const fingerprint = JSON.stringify(updates);
  const idempotencyKey = buildCrmActionIdempotencyKey({
    conversationId: idempotencyContext.conversationId,
    clientMessage: idempotencyContext.clientMessage,
    actionType: "contact_updates",
    actionFingerprint: fingerprint,
  });

  if (await hasCrmIdempotencyKey(admin, businessId, idempotencyKey)) {
    return [];
  }

  const applied: string[] = [];
  const patch: Database["public"]["Tables"]["contacts"]["Update"] = {};
  const customFields: ContactCustomFields = { ...contact.customFields };

  if (updates.name?.trim()) {
    const nextName = updates.name.trim();

    if (
      isPlaceholderContactName(contact.name, contact.phoneNumber) ||
      nextName.length > contact.name.trim().length
    ) {
      patch.name = nextName;
      applied.push(`Contact name → ${nextName}`);
    }
  }

  if (updates.email?.trim()) {
    const nextEmail = updates.email.trim();

    if (!contact.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      patch.email = nextEmail;
      applied.push(`Email → ${nextEmail}`);
    }
  }

  if (updates.phone?.trim()) {
    const nextPhone = updates.phone.trim();

    if (
      phoneDigitsOnly(nextPhone).length >= 7 &&
      !phoneDigitsMatch(nextPhone, contact.phoneNumber)
    ) {
      customFields.additionalContacts = mergeAdditionalPhone(
        customFields.additionalContacts ?? contact.customFields.additionalContacts,
        nextPhone,
      );
      applied.push(`Alternate phone → ${canonicalPhoneNumber(nextPhone) || nextPhone}`);
    }
  }

  if (updates.company?.trim()) {
    customFields.company = updates.company.trim();
    applied.push(`Company → ${updates.company.trim()}`);
  }

  if (updates.location?.trim()) {
    customFields.location = updates.location.trim();
    applied.push(`Location → ${updates.location.trim()}`);
  }

  if (updates.tags?.length) {
    const mergedTags = [...new Set([...contact.tags, ...updates.tags])].slice(
      0,
      20,
    );

    if (mergedTags.length > contact.tags.length) {
      patch.tags = mergedTags;
      applied.push(`Tags updated`);
    }
  }

  if (updates.pipelineStage) {
    patch.pipeline_stage = updates.pipelineStage;
    applied.push(`Pipeline → ${updates.pipelineStage}`);
  }

  if (updates.dealValue !== undefined) {
    patch.deal_value = updates.dealValue;
    applied.push(`Deal value → ${updates.dealValue}`);
  }

  if (updates.expectedCloseDate?.trim()) {
    patch.expected_close_date = updates.expectedCloseDate.trim();
    applied.push(`Expected close date saved`);
  }

  if (Object.keys(customFields).length > 0) {
    patch.custom_fields = customFields as unknown as Record<string, string>;
  }

  if (Object.keys(patch).length === 0) {
    await recordCrmIdempotencyKey(admin, {
      businessId,
      idempotencyKey,
      actionType: "contact_updates",
    });
    return applied;
  }

  const { error } = await admin
    .from("contacts")
    .update(patch)
    .eq("id", contact.id)
    .eq("business_id", businessId);

  if (error) {
    throw new Error(error.message);
  }

  if (
    updates.dealValue !== undefined ||
    updates.pipelineStage ||
    updates.expectedCloseDate
  ) {
    await syncPrimaryDeal(admin, businessId, contact.id, {
      dealValue: updates.dealValue ?? contact.dealValue,
      pipelineStage: updates.pipelineStage ?? contact.pipelineStage,
      expectedCloseDate:
        updates.expectedCloseDate?.trim() ?? contact.expectedCloseDate,
    });
  }

  await recordCrmIdempotencyKey(admin, {
    businessId,
    idempotencyKey,
    actionType: "contact_updates",
  });

  return applied;
}

async function hasRecentTask(
  admin: MessagingDbClient,
  businessId: string,
  contactId: string,
  title: string,
): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("crm_tasks")
    .select("id")
    .eq("business_id", businessId)
    .eq("contact_id", contactId)
    .eq("title", title)
    .gte("created_at", since)
    .limit(1);

  return Boolean(data?.length);
}

async function applyCreateTask(
  admin: MessagingDbClient,
  businessId: string,
  contactId: string,
  action: Extract<ExecutorAction, { type: "create_task" }>,
  idempotencyContext: {
    conversationId?: string | null;
    clientMessage: string;
  },
): Promise<string | null> {
  const title = action.title.trim();
  const idempotencyKey = buildCrmActionIdempotencyKey({
    conversationId: idempotencyContext.conversationId,
    clientMessage: idempotencyContext.clientMessage,
    actionType: "create_task",
    actionFingerprint: title,
  });

  if (await hasCrmIdempotencyKey(admin, businessId, idempotencyKey)) {
    return null;
  }

  if (await hasRecentTask(admin, businessId, contactId, title)) {
    await recordCrmIdempotencyKey(admin, {
      businessId,
      idempotencyKey,
      actionType: "create_task",
    });
    return null;
  }

  const dueAt = action.dueAt?.trim() || null;
  const { error } = await admin.from("crm_tasks").insert({
    business_id: businessId,
    contact_id: contactId,
    title,
    due_at: dueAt,
    status: "open",
  });

  if (error) {
    throw new Error(error.message);
  }

  await recordCrmIdempotencyKey(admin, {
    businessId,
    idempotencyKey,
    actionType: "create_task",
  });

  if (dueAt) {
    const due = new Date(dueAt);
    if (!Number.isNaN(due.getTime())) {
      const start = due.toISOString();
      const end = new Date(due.getTime() + 30 * 60 * 1000).toISOString();
      void createCalendarTaskForBusiness({
        businessId,
        title,
        description: `CRM follow-up for contact ${contactId}`,
        startDateTime: start,
        endDateTime: end,
        dueAt: start,
        syncToGoogle: false,
      }).catch((err) => {
        console.warn(
          "[agent-executor] calendar task mirror failed",
          err instanceof Error ? err.message : err,
        );
      });
    }
  }

  return `Task created: ${title}`;
}

async function applyUpdateCollectedFields(
  admin: MessagingDbClient,
  businessId: string,
  contact: ContactSnapshot,
  action: Extract<ExecutorAction, { type: "update_collected_fields" }>,
  fields: DataCollectionField[],
  idempotencyContext: {
    conversationId?: string | null;
    clientMessage: string;
  },
): Promise<string[]> {
  const mapped = mapCollectedAnswersToContactUpdates(fields, action.answers);
  const contactUpdates: ExecutorContactUpdates = {};
  if (mapped.name) contactUpdates.name = mapped.name;
  if (mapped.email) contactUpdates.email = mapped.email;
  if (mapped.phone) contactUpdates.phone = mapped.phone;
  if (mapped.company) contactUpdates.company = mapped.company;
  if (mapped.location) contactUpdates.location = mapped.location;
  if (mapped.dealValue !== undefined) contactUpdates.dealValue = mapped.dealValue;
  if (mapped.expectedCloseDate) {
    contactUpdates.expectedCloseDate = mapped.expectedCloseDate;
  }

  const applied: string[] = [];

  if (Object.keys(contactUpdates).length > 0) {
    applied.push(
      ...(await applyContactUpdates(
        admin,
        businessId,
        contact,
        contactUpdates,
        idempotencyContext,
      )),
    );
  }

  if (Object.keys(mapped.collectionAnswers).length === 0) {
    return applied;
  }

  const fingerprint = JSON.stringify(mapped.collectionAnswers);
  const idempotencyKey = buildCrmActionIdempotencyKey({
    conversationId: idempotencyContext.conversationId,
    clientMessage: idempotencyContext.clientMessage,
    actionType: "update_collected_fields",
    actionFingerprint: fingerprint,
  });

  if (await hasCrmIdempotencyKey(admin, businessId, idempotencyKey)) {
    return applied;
  }

  const refreshed = await loadContactSnapshot(admin, businessId, contact.id);
  const baseCustom = (refreshed ?? contact).customFields as unknown as Record<
    string,
    unknown
  >;
  const nextCustom = mergeCollectionAnswersIntoCustomFields(
    baseCustom,
    mapped.collectionAnswers,
  );

  const { error } = await admin
    .from("contacts")
    .update({
      custom_fields: nextCustom as Database["public"]["Tables"]["contacts"]["Update"]["custom_fields"],
    })
    .eq("id", contact.id)
    .eq("business_id", businessId);

  if (error) {
    throw new Error(error.message);
  }

  await recordCrmIdempotencyKey(admin, {
    businessId,
    idempotencyKey,
    actionType: "update_collected_fields",
  });

  applied.push(
    `Collected fields: ${Object.keys(mapped.collectionAnswers).join(", ")}`,
  );
  return applied;
}

async function applyScheduleFollowUp(
  admin: MessagingDbClient,
  businessId: string,
  contact: ContactSnapshot,
  action: Extract<ExecutorAction, { type: "schedule_follow_up" }>,
  idempotencyContext: {
    conversationId?: string | null;
    clientMessage: string;
    channel?: MessagingChannel;
  },
): Promise<string | null> {
  if (!idempotencyContext.conversationId || !idempotencyContext.channel) {
    return null;
  }

  const delayHours = action.delayHours ?? 24;
  const idempotencyKey = buildCrmActionIdempotencyKey({
    conversationId: idempotencyContext.conversationId,
    clientMessage: idempotencyContext.clientMessage,
    actionType: "schedule_follow_up",
    actionFingerprint: `${delayHours}|${action.reason ?? ""}`,
  });

  if (await hasCrmIdempotencyKey(admin, businessId, idempotencyKey)) {
    return null;
  }

  await scheduleOrchestratorFollowUp({
    admin,
    businessId,
    conversationId: idempotencyContext.conversationId,
    channel: idempotencyContext.channel,
    delayHours,
    contactName: contact.name,
    reason: action.reason,
  });

  await recordCrmIdempotencyKey(admin, {
    businessId,
    idempotencyKey,
    actionType: "schedule_follow_up",
  });

  return `Follow-up scheduled in ${delayHours}h`;
}

async function applyRequestHuman(
  admin: MessagingDbClient,
  businessId: string,
  contact: ContactSnapshot,
  action: Extract<ExecutorAction, { type: "request_human" }>,
  idempotencyContext: {
    conversationId?: string | null;
    clientMessage: string;
    channel?: MessagingChannel;
  },
): Promise<string | null> {
  if (!idempotencyContext.conversationId || !idempotencyContext.channel) {
    return null;
  }

  const idempotencyKey = buildCrmActionIdempotencyKey({
    conversationId: idempotencyContext.conversationId,
    clientMessage: idempotencyContext.clientMessage,
    actionType: "request_human",
    actionFingerprint: action.reason,
  });

  if (await hasCrmIdempotencyKey(admin, businessId, idempotencyKey)) {
    return null;
  }

  const created = await createAiHumanRequest({
    admin,
    businessId,
    conversationId: idempotencyContext.conversationId,
    channel: idempotencyContext.channel,
    contactId: contact.id,
    contactName: contact.name,
    reason: action.reason,
    messagePreview: idempotencyContext.clientMessage,
  });

  if (!created) {
    return null;
  }

  await recordCrmIdempotencyKey(admin, {
    businessId,
    idempotencyKey,
    actionType: "request_human",
  });

  return `Human requested: ${action.reason}`;
}

async function applyListUpcoming(
  admin: MessagingDbClient,
  businessId: string,
  contact: ContactSnapshot,
  action: Extract<ExecutorAction, { type: "list_upcoming_for_contact" }>,
): Promise<string | null> {
  const events = await findUpcomingEventsForContact({
    admin,
    businessId,
    contactName: contact.name,
    contactEmail: contact.email,
    limit: action.limit ?? 5,
  });

  if (events.length === 0) {
    return "Upcoming: none found for this contact";
  }

  return `Upcoming: ${events
    .map(
      (event) =>
        `${event.title} @ ${event.startAt} (id:${event.id}${event.isBooking ? ", booking" : ""})`,
    )
    .join("; ")}`;
}

async function applyGetBookingStatus(
  admin: MessagingDbClient,
  businessId: string,
  contact: ContactSnapshot,
  action: Extract<ExecutorAction, { type: "get_booking_status" }>,
): Promise<string | null> {
  if (action.eventId) {
    const { data } = await admin
      .from("calendar_events")
      .select("id, title, start_at, end_at, is_booking, customer_name, customer_email")
      .eq("id", action.eventId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (!data) {
      return "Booking status: event not found";
    }

    if (!calendarEventBelongsToContact(data, contact)) {
      return "Booking status: event not found for this contact";
    }

    const started = new Date(data.start_at).getTime() <= Date.now();
    return `Booking status: ${data.title} ${started ? "started/past" : "upcoming"} ${data.start_at} → ${data.end_at} (id:${data.id})`;
  }

  const upcoming = await findUpcomingEventsForContact({
    admin,
    businessId,
    contactName: contact.name,
    contactEmail: contact.email,
    limit: 1,
  });

  if (upcoming.length === 0) {
    return "Booking status: no upcoming booking found";
  }

  const next = upcoming[0]!;
  return `Booking status: next is ${next.title} at ${next.startAt} (id:${next.id})`;
}

async function resolveContactEventId(
  admin: MessagingDbClient,
  businessId: string,
  contact: ContactSnapshot,
  eventId?: string,
): Promise<{ id: string; title: string; startAt: string; endAt: string } | null> {
  if (eventId) {
    const { data } = await admin
      .from("calendar_events")
      .select("id, title, start_at, end_at, customer_name, customer_email")
      .eq("id", eventId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (!data) return null;
    if (!calendarEventBelongsToContact(data, contact)) {
      return null;
    }
    return {
      id: data.id,
      title: data.title,
      startAt: data.start_at,
      endAt: data.end_at,
    };
  }

  const upcoming = await findUpcomingEventsForContact({
    admin,
    businessId,
    contactName: contact.name,
    contactEmail: contact.email,
    limit: 1,
  });
  const next = upcoming[0];
  return next
    ? {
        id: next.id,
        title: next.title,
        startAt: next.startAt,
        endAt: next.endAt,
      }
    : null;
}

async function applyRescheduleCalendarEvent(
  admin: MessagingDbClient,
  businessId: string,
  contact: ContactSnapshot,
  action: Extract<ExecutorAction, { type: "reschedule_calendar_event" }>,
  idempotencyContext: {
    conversationId?: string | null;
    clientMessage: string;
  },
): Promise<string | null> {
  const target = await resolveContactEventId(
    admin,
    businessId,
    contact,
    action.eventId,
  );
  if (!target) {
    return "Reschedule failed: no matching event";
  }

  const idempotencyKey = buildCrmActionIdempotencyKey({
    conversationId: idempotencyContext.conversationId,
    clientMessage: idempotencyContext.clientMessage,
    actionType: "reschedule_calendar_event",
    actionFingerprint: `${target.id}|${action.startDateTime}|${action.endDateTime}`,
  });

  if (await hasCrmIdempotencyKey(admin, businessId, idempotencyKey)) {
    return null;
  }

  const updated = await updateCalendarEventForBusiness({
    businessId,
    eventId: target.id,
    title: action.summary,
    startDateTime: action.startDateTime,
    endDateTime: action.endDateTime,
    timeZone: action.timeZone,
  });

  if (!updated.success) {
    return `Reschedule failed: ${updated.message ?? "unknown error"}`;
  }

  await recordCrmIdempotencyKey(admin, {
    businessId,
    idempotencyKey,
    actionType: "reschedule_calendar_event",
  });

  return `Rescheduled: ${action.summary ?? target.title} → ${action.startDateTime}`;
}

async function applyCancelCalendarEvent(
  admin: MessagingDbClient,
  businessId: string,
  contact: ContactSnapshot,
  action: Extract<ExecutorAction, { type: "cancel_calendar_event" }>,
  idempotencyContext: {
    conversationId?: string | null;
    clientMessage: string;
  },
): Promise<string | null> {
  const target = await resolveContactEventId(
    admin,
    businessId,
    contact,
    action.eventId,
  );
  if (!target) {
    return "Cancel failed: no matching event";
  }

  const idempotencyKey = buildCrmActionIdempotencyKey({
    conversationId: idempotencyContext.conversationId,
    clientMessage: idempotencyContext.clientMessage,
    actionType: "cancel_calendar_event",
    actionFingerprint: target.id,
  });

  if (await hasCrmIdempotencyKey(admin, businessId, idempotencyKey)) {
    return null;
  }

  const deleted = await deleteCalendarEventForBusiness({
    businessId,
    eventId: target.id,
  });

  if (!deleted.success) {
    return `Cancel failed: ${deleted.message ?? "unknown error"}`;
  }

  await admin
    .from("event_reminder_jobs")
    .update({ status: "cancelled", last_error: action.reason ?? "cancelled" })
    .eq("event_id", target.id)
    .eq("business_id", businessId)
    .eq("status", "pending");

  await recordCrmIdempotencyKey(admin, {
    businessId,
    idempotencyKey,
    actionType: "cancel_calendar_event",
  });

  return `Cancelled: ${target.title}${action.reason ? ` (${action.reason})` : ""}`;
}

async function applyUpdateTaskStatus(
  admin: MessagingDbClient,
  businessId: string,
  contactId: string,
  action: Extract<ExecutorAction, { type: "update_task_status" }>,
  idempotencyContext: {
    conversationId?: string | null;
    clientMessage: string;
  },
): Promise<string | null> {
  let taskId = action.taskId;

  if (!taskId && action.title?.trim()) {
    const { data } = await admin
      .from("crm_tasks")
      .select("id")
      .eq("business_id", businessId)
      .eq("contact_id", contactId)
      .ilike("title", action.title.trim())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    taskId = data?.id;
  }

  if (!taskId) {
    const { data } = await admin
      .from("crm_tasks")
      .select("id, title")
      .eq("business_id", businessId)
      .eq("contact_id", contactId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    taskId = data?.id;
  }

  if (!taskId) {
    return "Task status update failed: no task found";
  }

  const idempotencyKey = buildCrmActionIdempotencyKey({
    conversationId: idempotencyContext.conversationId,
    clientMessage: idempotencyContext.clientMessage,
    actionType: "update_task_status",
    actionFingerprint: `${taskId}|${action.status}`,
  });

  if (await hasCrmIdempotencyKey(admin, businessId, idempotencyKey)) {
    return null;
  }

  const { error } = await admin
    .from("crm_tasks")
    .update({ status: action.status })
    .eq("id", taskId)
    .eq("business_id", businessId);

  if (error) {
    throw new Error(error.message);
  }

  await recordCrmIdempotencyKey(admin, {
    businessId,
    idempotencyKey,
    actionType: "update_task_status",
  });

  return `Task ${action.status}: ${taskId}`;
}

async function applyUpdateDealStage(
  admin: MessagingDbClient,
  businessId: string,
  contactId: string,
  action: Extract<ExecutorAction, { type: "update_deal_stage" }>,
  idempotencyContext: {
    conversationId?: string | null;
    clientMessage: string;
  },
): Promise<string | null> {
  let dealId = action.dealId;

  if (!dealId) {
    let query = admin
      .from("crm_deals")
      .select("id")
      .eq("business_id", businessId)
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (action.title?.trim()) {
      query = admin
        .from("crm_deals")
        .select("id")
        .eq("business_id", businessId)
        .eq("contact_id", contactId)
        .ilike("title", action.title.trim())
        .order("created_at", { ascending: false })
        .limit(1);
    } else {
      query = admin
        .from("crm_deals")
        .select("id")
        .eq("business_id", businessId)
        .eq("contact_id", contactId)
        .eq("is_primary", true)
        .limit(1);
    }

    const { data } = await query.maybeSingle();
    dealId = data?.id;
  }

  if (!dealId) {
    return "Deal stage update failed: no deal found";
  }

  const idempotencyKey = buildCrmActionIdempotencyKey({
    conversationId: idempotencyContext.conversationId,
    clientMessage: idempotencyContext.clientMessage,
    actionType: "update_deal_stage",
    actionFingerprint: `${dealId}|${action.stage}`,
  });

  if (await hasCrmIdempotencyKey(admin, businessId, idempotencyKey)) {
    return null;
  }

  const { error } = await admin
    .from("crm_deals")
    .update({
      stage: action.stage,
      status: mapDealStatus(action.stage),
    })
    .eq("id", dealId)
    .eq("business_id", businessId);

  if (error) {
    throw new Error(error.message);
  }

  await admin
    .from("contacts")
    .update({ pipeline_stage: action.stage })
    .eq("id", contactId)
    .eq("business_id", businessId);

  await recordCrmIdempotencyKey(admin, {
    businessId,
    idempotencyKey,
    actionType: "update_deal_stage",
  });

  return `Deal stage → ${action.stage}`;
}

async function applySendCustomerMessage(
  admin: MessagingDbClient,
  businessId: string,
  action: Extract<ExecutorAction, { type: "send_customer_message" }>,
  idempotencyContext: {
    conversationId?: string | null;
    clientMessage: string;
    channel?: MessagingChannel;
  },
): Promise<string | null> {
  if (!idempotencyContext.conversationId || !idempotencyContext.channel) {
    return null;
  }

  const idempotencyKey = buildCrmActionIdempotencyKey({
    conversationId: idempotencyContext.conversationId,
    clientMessage: idempotencyContext.clientMessage,
    actionType: "send_customer_message",
    actionFingerprint: action.content.slice(0, 120),
  });

  if (await hasCrmIdempotencyKey(admin, businessId, idempotencyKey)) {
    return null;
  }

  const recentAiMessage = await getMessageRepository(admin).findLatestAiMessage(
    idempotencyContext.conversationId,
    businessId,
  );

  if (
    recentAiMessage?.content &&
    Date.now() - new Date(recentAiMessage.created_at).getTime() < 2 * 60 * 1000 &&
    messagesAreLikelyDuplicates(recentAiMessage.content, action.content)
  ) {
    return null;
  }

  const sent = await sendChannelAutoReplyText({
    admin,
    businessId,
    channel: idempotencyContext.channel,
    conversationId: idempotencyContext.conversationId,
    text: action.content,
  });

  if (!sent.success || !sent.sentText) {
    return `Send failed: ${sent.error ?? "unknown"}`;
  }

  await insertChannelMessage(admin, {
    conversationId: idempotencyContext.conversationId,
    channel: idempotencyContext.channel,
    content: sent.sentText,
    senderType: "ai",
    aiGenerated: true,
    emailSubject: sent.emailSubject,
  });

  await recordCrmIdempotencyKey(admin, {
    businessId,
    idempotencyKey,
    actionType: "send_customer_message",
  });

  return "Customer message sent";
}

async function applyScheduleEventReminder(
  admin: MessagingDbClient,
  businessId: string,
  contact: ContactSnapshot,
  action: Extract<ExecutorAction, { type: "schedule_event_reminder" }>,
  idempotencyContext: {
    conversationId?: string | null;
    clientMessage: string;
    channel?: MessagingChannel;
  },
): Promise<string | null> {
  if (!idempotencyContext.conversationId || !idempotencyContext.channel) {
    return null;
  }

  const target = await resolveContactEventId(
    admin,
    businessId,
    contact,
    action.eventId,
  );
  if (!target) {
    return "Event reminder failed: no upcoming event";
  }

  const hoursBefore = action.hoursBefore ?? 24;
  const idempotencyKey = buildCrmActionIdempotencyKey({
    conversationId: idempotencyContext.conversationId,
    clientMessage: idempotencyContext.clientMessage,
    actionType: "schedule_event_reminder",
    actionFingerprint: `${target.id}|${hoursBefore}`,
  });

  if (await hasCrmIdempotencyKey(admin, businessId, idempotencyKey)) {
    return null;
  }

  const scheduled = await scheduleEventReminderJob({
    admin,
    businessId,
    conversationId: idempotencyContext.conversationId,
    channel: idempotencyContext.channel,
    contactId: contact.id,
    eventId: target.id,
    eventStartAt: target.startAt,
    hoursBefore,
    messageBody: action.message,
    eventTitle: target.title,
  });

  if (!scheduled.success) {
    return `Event reminder failed: ${scheduled.message ?? "unknown"}`;
  }

  await recordCrmIdempotencyKey(admin, {
    businessId,
    idempotencyKey,
    actionType: "schedule_event_reminder",
  });

  return `Event reminder scheduled ${hoursBefore}h before (${target.title})`;
}

async function hasRecentDeal(
  admin: MessagingDbClient,
  businessId: string,
  contactId: string,
  title: string,
): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("crm_deals")
    .select("id")
    .eq("business_id", businessId)
    .eq("contact_id", contactId)
    .eq("title", title)
    .gte("created_at", since)
    .limit(1);

  return Boolean(data?.length);
}

async function findOpenDealForContact(
  admin: MessagingDbClient,
  businessId: string,
  contactId: string,
  dealId?: string,
  title?: string,
): Promise<{ id: string; title: string } | null> {
  if (dealId) {
    const { data } = await admin
      .from("crm_deals")
      .select("id, title")
      .eq("id", dealId)
      .eq("business_id", businessId)
      .eq("contact_id", contactId)
      .maybeSingle();
    return data ? { id: String(data.id), title: String(data.title ?? "") } : null;
  }

  if (title?.trim()) {
    const { data } = await admin
      .from("crm_deals")
      .select("id, title")
      .eq("business_id", businessId)
      .eq("contact_id", contactId)
      .ilike("title", title.trim())
      .not("status", "eq", "lost")
      .not("status", "eq", "won")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      return { id: String(data.id), title: String(data.title ?? "") };
    }
  }

  const { data: primary } = await admin
    .from("crm_deals")
    .select("id, title")
    .eq("business_id", businessId)
    .eq("contact_id", contactId)
    .eq("is_primary", true)
    .not("status", "eq", "lost")
    .not("status", "eq", "won")
    .maybeSingle();

  if (primary) {
    return { id: String(primary.id), title: String(primary.title ?? "") };
  }

  const { data: latest } = await admin
    .from("crm_deals")
    .select("id, title")
    .eq("business_id", businessId)
    .eq("contact_id", contactId)
    .not("status", "eq", "lost")
    .not("status", "eq", "won")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return latest
    ? { id: String(latest.id), title: String(latest.title ?? "") }
    : null;
}

async function applyUpdateDeal(
  admin: MessagingDbClient,
  businessId: string,
  contactId: string,
  action: Extract<ExecutorAction, { type: "update_deal" }>,
  idempotencyContext: {
    conversationId?: string | null;
    clientMessage: string;
  },
): Promise<string | null> {
  const deal = await findOpenDealForContact(
    admin,
    businessId,
    contactId,
    action.dealId,
    action.title,
  );

  if (!deal) {
    return null;
  }

  const fingerprint = [
    action.dealId ?? deal.id,
    action.title ?? "",
    action.value ?? "",
    action.stage ?? "",
    action.notes ?? "",
  ].join(":");

  const idempotencyKey = buildCrmActionIdempotencyKey({
    conversationId: idempotencyContext.conversationId,
    clientMessage: idempotencyContext.clientMessage,
    actionType: "update_deal",
    actionFingerprint: fingerprint,
  });

  if (await hasCrmIdempotencyKey(admin, businessId, idempotencyKey)) {
    return null;
  }

  const patch: {
    updated_at: string;
    title?: string;
    value?: number;
    stage?: string;
    status?: string;
    notes?: string;
  } = {
    updated_at: new Date().toISOString(),
  };

  if (action.title?.trim()) {
    patch.title = action.title.trim();
  }
  if (action.value != null) {
    patch.value = action.value;
  }
  if (action.stage) {
    patch.stage = action.stage;
    patch.status = mapDealStatus(action.stage);
  }
  if (action.notes?.trim()) {
    patch.notes = action.notes.trim();
  }

  if (Object.keys(patch).length <= 1) {
    return null;
  }

  const { error } = await admin
    .from("crm_deals")
    .update(patch)
    .eq("id", deal.id)
    .eq("business_id", businessId);

  if (error) {
    throw new Error(error.message);
  }

  await recordCrmIdempotencyKey(admin, {
    businessId,
    idempotencyKey,
    actionType: "update_deal",
  });

  const parts = [
    action.title?.trim() || deal.title,
    action.value != null ? `value ${action.value}` : null,
    action.stage ? `stage ${action.stage}` : null,
  ].filter(Boolean);

  return `Deal updated: ${parts.join(" · ")}`;
}

async function applyCreateDeal(
  admin: MessagingDbClient,
  businessId: string,
  contactId: string,
  action: Extract<ExecutorAction, { type: "create_deal" }>,
  idempotencyContext: {
    conversationId?: string | null;
    clientMessage: string;
  },
): Promise<string | null> {
  const title = action.title.trim();

  if (GENERIC_DEAL_TITLES.has(title.toLowerCase())) {
    return null;
  }

  // Prefer updating an existing open deal instead of creating duplicates.
  const existingOpen = await findOpenDealForContact(
    admin,
    businessId,
    contactId,
    undefined,
    title,
  );

  if (existingOpen) {
    return applyUpdateDeal(
      admin,
      businessId,
      contactId,
      {
        type: "update_deal",
        dealId: existingOpen.id,
        title,
        value: action.value,
        stage: action.stage,
        notes: action.notes,
      },
      idempotencyContext,
    );
  }

  const anyOpen = await findOpenDealForContact(admin, businessId, contactId);
  if (anyOpen) {
    return applyUpdateDeal(
      admin,
      businessId,
      contactId,
      {
        type: "update_deal",
        dealId: anyOpen.id,
        title,
        value: action.value,
        stage: action.stage,
        notes: action.notes,
      },
      idempotencyContext,
    );
  }

  const idempotencyKey = buildCrmActionIdempotencyKey({
    conversationId: idempotencyContext.conversationId,
    clientMessage: idempotencyContext.clientMessage,
    actionType: "create_deal",
    actionFingerprint: title,
  });

  if (await hasCrmIdempotencyKey(admin, businessId, idempotencyKey)) {
    return null;
  }

  if (await hasRecentDeal(admin, businessId, contactId, title)) {
    await recordCrmIdempotencyKey(admin, {
      businessId,
      idempotencyKey,
      actionType: "create_deal",
    });
    return null;
  }

  const stage = action.stage ?? "new";
  const { error } = await admin.from("crm_deals").insert({
    business_id: businessId,
    contact_id: contactId,
    title,
    value: action.value ?? null,
    stage,
    status: mapDealStatus(stage),
    notes: action.notes?.trim() || null,
    is_primary: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  await recordCrmIdempotencyKey(admin, {
    businessId,
    idempotencyKey,
    actionType: "create_deal",
  });

  return `Deal created: ${title}`;
}

async function applyCreateOrder(
  admin: MessagingDbClient,
  businessId: string,
  contactId: string,
  action: Extract<ExecutorAction, { type: "create_order" }>,
  idempotencyContext: {
    conversationId?: string | null;
    clientMessage: string;
    channel?: MessagingChannel;
  },
): Promise<string | null> {
  const { getEnabledOrderFormFields, isOrderFormBuiltinKey, resolveOrderTitle } =
    await import("@/features/orders/order-form-fields");
  const { getOrderFormFieldsForBusiness } = await import(
    "@/services/order-form-fields.service"
  );
  const { toCrmOrderSource } = await import("@/types/crm-order.types");
  const { createCrmOrder } = await import("@/services/crm-orders.service");

  const formFields = getEnabledOrderFormFields(
    await getOrderFormFieldsForBusiness(businessId),
  );
  const customFromAction = action.fields ?? {};

  const valuesByKey: Record<string, string> = {
    customerName: action.customerName?.trim() ?? "",
    phone: action.phone?.trim() ?? "",
    email: action.email?.trim() ?? "",
    title: action.title?.trim() ?? "",
    serviceType: action.serviceType?.trim() ?? "",
    description: action.description?.trim() ?? "",
    amount: action.amount != null ? String(action.amount) : "",
    ...Object.fromEntries(
      Object.entries(customFromAction).map(([key, value]) => [
        key,
        value.trim(),
      ]),
    ),
  };

  for (const field of formFields) {
    if (!field.required) continue;
    const value = valuesByKey[field.key] ?? "";
    if (!value) {
      throw new Error(`Order field "${field.label}" is required.`);
    }
  }

  const title = resolveOrderTitle({
    title: valuesByKey.title,
    customerName: valuesByKey.customerName,
    serviceType: valuesByKey.serviceType,
    description: valuesByKey.description,
  });

  const hasAnyField = Object.values(valuesByKey).some((value) => value.trim());
  if (!hasAnyField) {
    return null;
  }

  const idempotencyKey = buildCrmActionIdempotencyKey({
    conversationId: idempotencyContext.conversationId,
    clientMessage: idempotencyContext.clientMessage,
    actionType: "create_order",
    actionFingerprint: title,
  });

  if (await hasCrmIdempotencyKey(admin, businessId, idempotencyKey)) {
    return null;
  }

  const customPayloadFields: Record<string, string> = {};
  for (const [key, value] of Object.entries(valuesByKey)) {
    if (isOrderFormBuiltinKey(key) || key === "source") continue;
    if (!value.trim()) continue;
    customPayloadFields[key] = value.trim();
  }

  const amountValue = valuesByKey.amount
    ? Number.parseFloat(valuesByKey.amount)
    : action.amount;

  const result = await createCrmOrder({
    businessId,
    contactId,
    conversationId: idempotencyContext.conversationId ?? null,
    title,
    description: valuesByKey.description || null,
    source: toCrmOrderSource(idempotencyContext.channel),
    amount:
      amountValue != null && Number.isFinite(amountValue) ? amountValue : null,
    payload: {
      customerName: valuesByKey.customerName || null,
      phone: valuesByKey.phone || null,
      email: valuesByKey.email || null,
      serviceType: valuesByKey.serviceType || null,
      fields: customPayloadFields,
    },
  });

  if (!result.success) {
    throw new Error(result.message);
  }

  await recordCrmIdempotencyKey(admin, {
    businessId,
    idempotencyKey,
    actionType: "create_order",
  });

  return `Order created: ${title}`;
}

async function applyAddNote(
  admin: MessagingDbClient,
  businessId: string,
  contact: ContactSnapshot,
  action: Extract<ExecutorAction, { type: "add_note" }>,
  idempotencyContext: {
    conversationId?: string | null;
    clientMessage: string;
  },
): Promise<string | null> {
  const noteLine = action.content.trim();
  const idempotencyKey = buildCrmActionIdempotencyKey({
    conversationId: idempotencyContext.conversationId,
    clientMessage: idempotencyContext.clientMessage,
    actionType: "add_note",
    actionFingerprint: noteLine,
  });

  if (await hasCrmIdempotencyKey(admin, businessId, idempotencyKey)) {
    return null;
  }

  const timestamp = new Date().toISOString().slice(0, 16).replace("T", " ");
  const existingNotes = contact.customFields.notes?.trim() ?? "";
  const nextNotes = existingNotes
    ? `${existingNotes}\n\n[${timestamp}] ${noteLine}`
    : `[${timestamp}] ${noteLine}`;

  const customFields: ContactCustomFields = {
    ...contact.customFields,
    notes: nextNotes.slice(0, 4000),
  };

  const existingDescription = contact.aiSummary?.trim() ?? "";

  // Prefer a fresh portrait for the CRM client description field; keep owner text
  // if the new line is already covered.
  const nextDescription =
    existingDescription &&
    existingDescription.toLowerCase().includes(noteLine.toLowerCase())
      ? existingDescription
      : noteLine.slice(0, 800);

  const { error } = await admin
    .from("contacts")
    .update({
      custom_fields: customFields as unknown as Record<string, string>,
      ai_summary: nextDescription,
    })
    .eq("id", contact.id)
    .eq("business_id", businessId);

  if (error) {
    throw new Error(error.message);
  }

  await recordCrmIdempotencyKey(admin, {
    businessId,
    idempotencyKey,
    actionType: "add_note",
  });

  return "Note saved on contact";
}

async function applyAddInternalNote(
  admin: MessagingDbClient,
  businessId: string,
  conversationId: string | null | undefined,
  action: Extract<ExecutorAction, { type: "add_internal_note" }>,
  idempotencyContext: {
    conversationId?: string | null;
    clientMessage: string;
  },
): Promise<string | null> {
  if (!conversationId) {
    return null;
  }

  const noteLine = action.content.trim();
  const idempotencyKey = buildCrmActionIdempotencyKey({
    conversationId: idempotencyContext.conversationId,
    clientMessage: idempotencyContext.clientMessage,
    actionType: "add_internal_note",
    actionFingerprint: noteLine,
  });

  if (await hasCrmIdempotencyKey(admin, businessId, idempotencyKey)) {
    return null;
  }

  await getConversationRepository(admin).appendInternalNote({
    conversationId,
    businessId,
    noteLine,
  });

  await recordCrmIdempotencyKey(admin, {
    businessId,
    idempotencyKey,
    actionType: "add_internal_note",
  });

  return "Manager note added in chat";
}

async function applyCreateCalendarEvent(
  admin: MessagingDbClient,
  businessId: string,
  contact: ContactSnapshot | null,
  action: Extract<ExecutorAction, { type: "create_calendar_event" }>,
  idempotencyContext: {
    conversationId?: string | null;
    clientMessage: string;
    channel?: MessagingChannel;
    contactId?: string;
    contactName?: string;
  },
): Promise<string | null> {
  const idempotencyKey = buildCrmActionIdempotencyKey({
    conversationId: idempotencyContext.conversationId,
    clientMessage: idempotencyContext.clientMessage,
    actionType: "create_calendar_event",
    actionFingerprint: `${action.summary}:${action.startDateTime}`,
  });

  if (await hasCrmIdempotencyKey(admin, businessId, idempotencyKey)) {
    return null;
  }

  const bookingResult = await createAiCalendarBooking({
    businessId,
    contact,
    summary: action.summary,
    startDateTime: action.startDateTime,
    endDateTime: action.endDateTime,
    timeZone: action.timeZone,
    description: action.description,
    resourceName: action.resourceName,
    resourceId: action.resourceId,
    bookingPageId: action.bookingPageId,
    formAnswers: action.formAnswers,
    clientMessage: idempotencyContext.clientMessage,
    preferNearestSlot: true,
  });

  if (!bookingResult.success) {
    // Do not lock the fingerprint on failure — allow a corrected retry.
    return `Booking not confirmed: ${bookingResult.message}`;
  }

  await recordCrmIdempotencyKey(admin, {
    businessId,
    idempotencyKey,
    actionType: "create_calendar_event",
  });

  if (
    idempotencyContext.conversationId &&
    idempotencyContext.channel
  ) {
    await createAiCalendarEventNotification({
      admin,
      businessId,
      conversationId: idempotencyContext.conversationId,
      channel: idempotencyContext.channel,
      contactId: idempotencyContext.contactId ?? null,
      contactName: idempotencyContext.contactName ?? null,
      summary: bookingResult.summary,
      startDateTime: action.startDateTime,
    });
  }

  const emailNote = bookingResult.customerEmail?.includes("@")
    ? " Confirmation email sent."
    : "";

  const resourceNote = bookingResult.resourceName
    ? ` (${bookingResult.resourceName})`
    : "";

  return bookingResult.rescheduled
    ? `Booking confirmed${resourceNote} — ${bookingResult.slotLabel} (nearest available slot).${emailNote}`
    : `Booking confirmed${resourceNote} — ${bookingResult.slotLabel}.${emailNote}`;
}

function isRequiredCollectionComplete(
  fields: DataCollectionField[],
  contact: ContactSnapshot,
): boolean {
  if (fields.length === 0) {
    return true;
  }

  const gaps = computeCollectionGaps({
    niche: "generic",
    storedFields: fields,
    contact: {
      name: contact.name,
      email: contact.email,
      phone: contact.phoneNumber,
      company: contact.customFields.company,
      location: contact.customFields.location,
      dealValue: contact.dealValue,
      expectedCloseDate: contact.expectedCloseDate,
      collection: contact.customFields.collection,
      customFields: contact.customFields as unknown as Record<string, unknown>,
    },
  });

  return gaps.requiredComplete;
}

async function applyExecutorPlan(
  admin: MessagingDbClient,
  businessId: string,
  contact: ContactSnapshot,
  plan: ExecutorPlan,
  idempotencyContext: {
    conversationId?: string | null;
    clientMessage: string;
    channel?: MessagingChannel;
    contactId?: string;
    contactName?: string;
  },
  options?: {
    dataCollectionFields?: DataCollectionField[];
    requiredComplete?: boolean;
  },
): Promise<{ applied: string[]; skipped: string[] }> {
  const applied: string[] = [];
  const skipped: string[] = [];
  const allowed = getAllowedActionTypes();
  const collectionFields = options?.dataCollectionFields ?? [];
  let requiredComplete = options?.requiredComplete ?? true;

  const collectionActions = plan.actions.filter(
    (action) => action.type === "update_collected_fields",
  );
  const otherActions = plan.actions.filter(
    (action) => action.type !== "update_collected_fields",
  );

  if (plan.contactUpdates && Object.keys(plan.contactUpdates).length > 0) {
    applied.push(
      ...(await applyContactUpdates(
        admin,
        businessId,
        contact,
        plan.contactUpdates,
        idempotencyContext,
      )),
    );
  }

  let workingContact =
    (await loadContactSnapshot(admin, businessId, contact.id)) ?? contact;

  if (plan.contactUpdates && Object.keys(plan.contactUpdates).length > 0) {
    requiredComplete = isRequiredCollectionComplete(
      collectionFields,
      workingContact,
    );
  }

  for (const action of collectionActions) {
    if (action.type !== "update_collected_fields") continue;
    const results = await applyUpdateCollectedFields(
      admin,
      businessId,
      workingContact,
      action,
      collectionFields,
      idempotencyContext,
    );
    if (results.length > 0) {
      applied.push(...results);
      workingContact =
        (await loadContactSnapshot(admin, businessId, contact.id)) ??
        workingContact;
      requiredComplete = isRequiredCollectionComplete(
        collectionFields,
        workingContact,
      );
      logAgentToolAudit({
        tool: action.type,
        businessId,
        conversationId: idempotencyContext.conversationId,
        contactId: contact.id,
        success: true,
        label: results.join("; "),
      });
    } else {
      skipped.push(formatSkippedDuplicate(action.type));
    }
  }

  for (const action of otherActions) {
    if (!allowed.has(action.type)) {
      continue;
    }

    // Soft gate: delay deal/order until required collection is complete.
    // Calendar booking uses booking-page validation separately — do not block it here.
    if (
      !requiredComplete &&
      (action.type === "create_deal" ||
        action.type === "create_order" ||
        action.type === "update_deal")
    ) {
      skipped.push(`${action.type} (waiting for required data)`);
      continue;
    }

    let result: string | null = null;

    if (action.type === "create_task") {
      result = await applyCreateTask(
        admin,
        businessId,
        workingContact.id,
        action,
        idempotencyContext,
      );
    } else if (action.type === "create_deal") {
      result = await applyCreateDeal(
        admin,
        businessId,
        workingContact.id,
        action,
        idempotencyContext,
      );
    } else if (action.type === "create_order") {
      result = await applyCreateOrder(
        admin,
        businessId,
        workingContact.id,
        action,
        idempotencyContext,
      );
    } else if (action.type === "update_deal") {
      result = await applyUpdateDeal(
        admin,
        businessId,
        workingContact.id,
        action,
        idempotencyContext,
      );
    } else if (action.type === "add_note") {
      const refreshed = await loadContactSnapshot(
        admin,
        businessId,
        workingContact.id,
      );
      result = await applyAddNote(
        admin,
        businessId,
        refreshed ?? workingContact,
        action,
        idempotencyContext,
      );
    } else if (action.type === "add_internal_note") {
      result = await applyAddInternalNote(
        admin,
        businessId,
        idempotencyContext.conversationId,
        action,
        idempotencyContext,
      );
    } else if (action.type === "create_calendar_event") {
      result = await applyCreateCalendarEvent(
        admin,
        businessId,
        workingContact,
        action,
        idempotencyContext,
      );
    } else if (action.type === "schedule_follow_up") {
      result = await applyScheduleFollowUp(
        admin,
        businessId,
        workingContact,
        action,
        idempotencyContext,
      );
    } else if (action.type === "request_human") {
      result = await applyRequestHuman(
        admin,
        businessId,
        workingContact,
        action,
        idempotencyContext,
      );
    } else if (action.type === "list_upcoming_for_contact") {
      result = await applyListUpcoming(
        admin,
        businessId,
        workingContact,
        action,
      );
    } else if (action.type === "get_booking_status") {
      result = await applyGetBookingStatus(
        admin,
        businessId,
        workingContact,
        action,
      );
    } else if (action.type === "reschedule_calendar_event") {
      result = await applyRescheduleCalendarEvent(
        admin,
        businessId,
        workingContact,
        action,
        idempotencyContext,
      );
    } else if (action.type === "cancel_calendar_event") {
      result = await applyCancelCalendarEvent(
        admin,
        businessId,
        workingContact,
        action,
        idempotencyContext,
      );
    } else if (action.type === "update_task_status") {
      result = await applyUpdateTaskStatus(
        admin,
        businessId,
        workingContact.id,
        action,
        idempotencyContext,
      );
    } else if (action.type === "update_deal_stage") {
      result = await applyUpdateDealStage(
        admin,
        businessId,
        workingContact.id,
        action,
        idempotencyContext,
      );
    } else if (action.type === "send_customer_message") {
      result = await applySendCustomerMessage(
        admin,
        businessId,
        action,
        idempotencyContext,
      );
    } else if (action.type === "schedule_event_reminder") {
      result = await applyScheduleEventReminder(
        admin,
        businessId,
        workingContact,
        action,
        idempotencyContext,
      );
    }

    if (result) {
      const actionSucceeded = !result.startsWith("Booking not confirmed:");
      applied.push(result);
      logAgentToolAudit({
        tool: action.type,
        businessId,
        conversationId: idempotencyContext.conversationId,
        contactId: contact.id,
        success: actionSucceeded,
        label: result,
      });
    } else {
      skipped.push(formatSkippedDuplicate(action.type));
    }
  }

  if (plan.contactUpdates && Object.keys(plan.contactUpdates).length > 0) {
    logAgentToolAudit({
      tool: "contact_updates",
      businessId,
      conversationId: idempotencyContext.conversationId,
      contactId: contact.id,
      success: true,
      label: applied.filter((entry) => entry.startsWith("Contact")).join("; ") || "contact updated",
    });
  }

  return { applied, skipped };
}

async function logAgentRun(
  admin: MessagingDbClient,
  input: {
    businessId: string;
    conversationId: string | null;
    contactId: string;
    channel: string;
    clientMessage: string;
    routingMethod: AgentRoutingMethod | null;
    actionsApplied: string[];
    success: boolean;
    errorMessage?: string;
  },
): Promise<void> {
  await admin.from("agent_runs").insert({
    business_id: input.businessId,
    conversation_id: input.conversationId,
    contact_id: input.contactId,
    channel: input.channel,
    client_message: input.clientMessage.slice(0, 2000),
    routing_method: input.routingMethod,
    actions: input.actionsApplied,
    success: input.success,
    error_message: input.errorMessage ?? null,
  });
}

async function executePlanOnContact(input: {
  admin: MessagingDbClient;
  businessId: string;
  contact: ContactSnapshot;
  contactId: string;
  conversationId?: string | null;
  channel: string;
  clientMessage: string;
  agent: RoutableAiAgent | null;
  routingMethod?: AgentRoutingMethod | null;
  plan: ExecutorPlan;
  suppressRunLog?: boolean;
  dataCollectionFields?: DataCollectionField[];
  requiredComplete?: boolean;
}): Promise<AgentExecutorResult> {
  const planIdempotencyKey = buildExecutorPlanIdempotencyKey({
    conversationId: input.conversationId,
    clientMessage: input.clientMessage,
  });

  if (
    await hasCrmIdempotencyKey(input.admin, input.businessId, planIdempotencyKey)
  ) {
    return {
      success: true,
      actionsApplied: [],
      skippedDuplicates: [formatSkippedDuplicate("executor_plan")],
      clientSummary: "",
      rawPlan: input.plan,
      planDuplicateSkipped: true,
    };
  }

  try {
    const { applied: actionsApplied, skipped: skippedDuplicates } =
      await applyExecutorPlan(
      input.admin,
      input.businessId,
      input.contact,
      input.plan,
      {
        conversationId: input.conversationId,
        clientMessage: input.clientMessage,
        channel: input.channel as MessagingChannel,
        contactId: input.contactId,
        contactName: input.contact.name,
      },
      {
        dataCollectionFields: input.dataCollectionFields,
        requiredComplete: input.requiredComplete,
      },
    );

    const bookingFailed = actionsApplied.some((action) =>
      action.startsWith("Booking not confirmed:"),
    );

    const clientSummary = sanitizeCustomerFacingSummary(
      input.plan.clientSummary,
    ) ?? "";

    if (!input.suppressRunLog) {
      await logAgentRun(input.admin, {
        businessId: input.businessId,
        conversationId: input.conversationId ?? null,
        contactId: input.contactId,
        channel: input.channel,
        clientMessage: input.clientMessage,
        routingMethod: input.routingMethod ?? null,
        actionsApplied,
        success: !bookingFailed,
        errorMessage: bookingFailed ? "Booking not confirmed" : undefined,
      });
    }

    if (!bookingFailed) {
      await recordCrmIdempotencyKey(input.admin, {
        businessId: input.businessId,
        idempotencyKey: planIdempotencyKey,
        actionType: "executor_plan",
      });
    }

    console.info(
      "[agent-executor]",
      JSON.stringify({
        contactId: input.contactId,
        actionsApplied,
        skippedDuplicates,
      }),
    );

    if (actionsApplied.length > 0) {
      revalidatePath(DASHBOARD_ROUTES.contacts);

      if (actionsApplied.some((action) => action.startsWith("Booking confirmed"))) {
        revalidatePath(DASHBOARD_ROUTES.calendar);
      }
    }

    return {
      success: !bookingFailed,
      actionsApplied,
      skippedDuplicates,
      clientSummary,
      rawPlan: input.plan,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "CRM action failed";

    if (!input.suppressRunLog) {
      await logAgentRun(input.admin, {
        businessId: input.businessId,
        conversationId: input.conversationId ?? null,
        contactId: input.contactId,
        channel: input.channel,
        clientMessage: input.clientMessage,
        routingMethod: input.routingMethod ?? null,
        actionsApplied: [],
        success: false,
        errorMessage,
      });
    }

    return {
      success: false,
      actionsApplied: [],
      skippedDuplicates: [],
      clientSummary: "",
      rawPlan: null,
      errorMessage,
    };
  }
}

async function applyCreateContact(
  admin: MessagingDbClient,
  businessId: string,
  conversationId: string,
  channel: MessagingChannel,
  action: Extract<ExecutorAction, { type: "create_contact" }>,
  clientMessage: string,
): Promise<{ contactId: string; label: string } | null> {
  const name = action.name.trim();

  if (!name) {
    return null;
  }

  const phone =
    action.phone?.trim() ||
    `pending:${conversationId.slice(0, 8)}`;
  const fingerprint = [
    name,
    phone,
    action.email?.trim() || "",
    action.company?.trim() || "",
    action.pipelineStage ?? "new",
  ].join("|");
  const idempotencyKey = buildCrmActionIdempotencyKey({
    conversationId,
    clientMessage,
    actionType: "create_contact",
    actionFingerprint: fingerprint,
  });

  if (await hasCrmIdempotencyKey(admin, businessId, idempotencyKey)) {
    const { data: linked } = await admin
      .from("conversations")
      .select("contact_id")
      .eq("id", conversationId)
      .eq("business_id", businessId)
      .maybeSingle();

    if (linked?.contact_id) {
      return {
        contactId: linked.contact_id,
        label: `Contact already linked: ${name}`,
      };
    }

    return null;
  }

  const customFields: ContactCustomFields = {};

  if (action.company?.trim()) {
    customFields.company = action.company.trim();
  }

  const { data, error } = await admin
    .from("contacts")
    .insert({
      business_id: businessId,
      name,
      phone_number: phone,
      email: action.email?.trim() || null,
      channel,
      pipeline_stage: action.pipelineStage ?? "new",
      custom_fields: customFields as unknown as Record<string, string>,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create contact");
  }

  const { error: linkError } = await admin
    .from("conversations")
    .update({ contact_id: data.id })
    .eq("id", conversationId)
    .eq("business_id", businessId);

  if (linkError) {
    throw new Error(linkError.message);
  }

  await recordCrmIdempotencyKey(admin, {
    businessId,
    idempotencyKey,
    actionType: "create_contact",
  });

  return {
    contactId: data.id,
    label: `Contact created: ${name}`,
  };
}

export async function applyCreateContactFromPlan(input: {
  admin: MessagingDbClient;
  businessId: string;
  conversationId: string;
  channel: MessagingChannel;
  action: Extract<
    ExecutorAction,
    { type: "create_contact" | "create_lead" }
  >;
  clientMessage: string;
}): Promise<{ contactId: string; label: string } | null> {
  const normalized: Extract<ExecutorAction, { type: "create_contact" }> = {
    type: "create_contact",
    name: input.action.name,
    phone: input.action.phone,
    email: input.action.email,
    company: input.action.company,
    pipelineStage:
      input.action.type === "create_lead"
        ? (input.action.pipelineStage ?? "new")
        : input.action.pipelineStage,
  };

  return applyCreateContact(
    input.admin,
    input.businessId,
    input.conversationId,
    input.channel,
    normalized,
    input.clientMessage,
  );
}

export async function applyPreparedExecutorPlan(input: {
  admin: MessagingDbClient;
  businessId: string;
  contactId: string;
  conversationId?: string | null;
  channel: string;
  clientMessage: string;
  agent: RoutableAiAgent | null;
  routingMethod?: AgentRoutingMethod | null;
  plan: ExecutorPlan;
  suppressRunLog?: boolean;
  dataCollectionFields?: DataCollectionField[];
  requiredComplete?: boolean;
}): Promise<AgentExecutorResult> {
  const contact = await loadContactSnapshot(
    input.admin,
    input.businessId,
    input.contactId,
  );

  if (!contact) {
    return {
      success: false,
      actionsApplied: [],
      skippedDuplicates: [],
      clientSummary: "",
      rawPlan: null,
      errorMessage: "Contact not found",
    };
  }

  return executePlanOnContact({
    admin: input.admin,
    businessId: input.businessId,
    contact,
    contactId: input.contactId,
    conversationId: input.conversationId,
    channel: input.channel,
    clientMessage: input.clientMessage,
    agent: input.agent,
    routingMethod: input.routingMethod,
    plan: input.plan,
    suppressRunLog: input.suppressRunLog,
    dataCollectionFields: input.dataCollectionFields,
    requiredComplete: input.requiredComplete,
  });
}
