import { CUSTOMER_INTENTS, type CustomerIntent } from "@/types/intent-router.types";
import { PIPELINE_STAGES } from "@/types/contact.types";

const VALID_INTENTS = new Set<string>(CUSTOMER_INTENTS);
const VALID_PIPELINE = new Set<string>(PIPELINE_STAGES);

const INTENT_ALIASES: Record<string, CustomerIntent> = {
  appointment: "booking",
  appointments: "booking",
  reservation: "booking",
  reservations: "booking",
  schedule: "booking",
  order: "sales",
  purchase: "sales",
  support: "support",
  help: "support",
  register: "registration",
  signup: "registration",
  general: "general",
  none: "none",
  booking: "booking",
  sales: "sales",
  registration: "registration",
};

const CONTACT_UPDATE_KEYS = new Set([
  "name",
  "email",
  "phone",
  "company",
  "location",
  "pipelineStage",
  "tags",
  "dealValue",
  "expectedCloseDate",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function coerceString(value: unknown, maxLen: number): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  return trimmed.slice(0, maxLen);
}

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function coerceBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true" || value === 1 || value === "1") {
    return true;
  }

  if (value === "false" || value === 0 || value === "0") {
    return false;
  }

  return fallback;
}

function normalizeIntent(value: unknown): CustomerIntent {
  const raw = coerceString(value, 40)?.toLowerCase();

  if (!raw) {
    return "general";
  }

  if (VALID_INTENTS.has(raw)) {
    return raw as CustomerIntent;
  }

  return INTENT_ALIASES[raw] ?? "general";
}

function normalizeContactUpdates(
  value: unknown,
): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const out: Record<string, unknown> = {};

  for (const key of CONTACT_UPDATE_KEYS) {
    if (!(key in value)) {
      continue;
    }

    const raw = value[key];

    if (key === "tags" && Array.isArray(raw)) {
      const tags = raw
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 10);

      if (tags.length > 0) {
        out.tags = tags;
      }

      continue;
    }

    if (key === "dealValue") {
      const num = coerceNumber(raw);

      if (num != null) {
        out.dealValue = num;
      }

      continue;
    }

    if (key === "pipelineStage") {
      const stage = coerceString(raw, 32);

      if (stage && VALID_PIPELINE.has(stage)) {
        out.pipelineStage = stage;
      }

      continue;
    }

    const str = coerceString(raw, key === "email" ? 320 : 200);

    if (str) {
      out[key] = str;
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

function recordFromUnknown(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const out: Record<string, string> = {};

  for (const [key, raw] of Object.entries(value)) {
    const str = coerceString(raw, 500);

    if (str) {
      out[key] = str;
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeUuid(value: unknown): string | undefined {
  const str = coerceString(value, 40);

  if (!str) {
    return undefined;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    str,
  )
    ? str
    : undefined;
}

function addMinutesToIso(startIso: string, minutes: number): string | undefined {
  const ms = Date.parse(startIso);

  if (Number.isNaN(ms)) {
    return undefined;
  }

  return new Date(ms + minutes * 60_000).toISOString();
}

function normalizeCalendarEventAction(
  action: Record<string, unknown>,
): Record<string, unknown> | null {
  const summary =
    coerceString(action.summary, 200) ??
    coerceString(action.title, 200) ??
    "Appointment";

  const startDateTime =
    coerceString(action.startDateTime, 80) ??
    coerceString(action.start, 80) ??
    coerceString(action.startAt, 80);

  if (!startDateTime) {
    return null;
  }

  let endDateTime =
    coerceString(action.endDateTime, 80) ??
    coerceString(action.end, 80) ??
    coerceString(action.endAt, 80);

  if (!endDateTime) {
    endDateTime = addMinutesToIso(startDateTime, 60);
  }

  if (!endDateTime) {
    return null;
  }

  const out: Record<string, unknown> = {
    type: "create_calendar_event",
    summary,
    startDateTime,
    endDateTime,
    timeZone: coerceString(action.timeZone, 80) ?? "UTC",
  };

  const description = coerceString(action.description, 2000);

  if (description) {
    out.description = description;
  }

  const resourceName = coerceString(action.resourceName, 120);

  if (resourceName) {
    out.resourceName = resourceName;
  }

  const resourceId = normalizeUuid(action.resourceId);

  if (resourceId) {
    out.resourceId = resourceId;
  }

  const bookingPageId = normalizeUuid(action.bookingPageId);

  if (bookingPageId) {
    out.bookingPageId = bookingPageId;
  }

  const formAnswers = recordFromUnknown(action.formAnswers);

  if (formAnswers) {
    out.formAnswers = formAnswers;
  }

  return out;
}

function normalizeAction(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) {
    return null;
  }

  const type = coerceString(raw.type, 80);

  if (!type) {
    return null;
  }

  if (type === "create_calendar_event") {
    return normalizeCalendarEventAction(raw);
  }

  const out: Record<string, unknown> = { type };

  for (const [key, value] of Object.entries(raw)) {
    if (key === "type") {
      continue;
    }

    if (value === null || value === undefined || value === "") {
      continue;
    }

    out[key] = value;
  }

  return out;
}

/** Coerce LLM/tool output into a shape Zod can validate reliably. */
export function normalizeOrchestratorPayload(parsed: unknown): unknown {
  if (!isRecord(parsed)) {
    return parsed;
  }

  const actionsRaw = parsed.actions;

  const actions = Array.isArray(actionsRaw)
    ? actionsRaw
        .map((item) => normalizeAction(item))
        .filter((item): item is Record<string, unknown> => item != null)
        .slice(0, 5)
    : [];

  const confidenceRaw = coerceNumber(parsed.confidence);
  const confidence = Math.min(
    1,
    Math.max(0, confidenceRaw ?? 0.7),
  );

  return {
    intent: normalizeIntent(parsed.intent),
    confidence,
    managerAlert: coerceBoolean(parsed.managerAlert, false),
    handoffConfirmed: coerceBoolean(parsed.handoffConfirmed, false),
    humanReason: coerceString(parsed.humanReason, 300),
    clientSummary: coerceString(parsed.clientSummary, 500),
    contactUpdates: normalizeContactUpdates(parsed.contactUpdates),
    actions,
  };
}
