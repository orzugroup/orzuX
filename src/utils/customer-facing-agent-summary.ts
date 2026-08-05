import { sanitizeCustomerFacingReply } from "@/utils/customer-facing-reply-guard";

const INTERNAL_SUMMARY_PATTERNS = [
  /^saved to crm:/i,
  /manager note/i,
  /\binternal note\b/i,
  /\bteam-only\b/i,
  /\bcrm\b/i,
  /\bthe customer is\b/i,
  /\bcustomer is impatient\b/i,
  /\bcustomer wants\b/i,
  /\bowner as soon as possible\b/i,
  /\bhuman handoff\b/i,
  /\borchestrator\b/i,
  /\bnotified\b.*\b(team|manager)\b/i,
  /\bmanager\b.*\b(join|connect)\b/i,
  /(передал|передам|передаю)[\s\S]{0,120}(менеджер|менеджеру|администратор|сотрудник|специалист)/i,
  /\bmenejerga yetkazdim\b/i,
];

const INTERNAL_ACTION_LABEL_PATTERNS = [
  /^manager note added/i,
  /^note added in chat$/i,
  /^contact updated:/i,
  /^crm\b/i,
];

export const BOOKING_SUCCESS_ACTION_PATTERNS = [
  /^booking confirmed/i,
  /^calendar event created/i,
];

const BOOKING_FAILURE_ACTION_PATTERNS = [
  /^booking not confirmed:/i,
  /^booking not created:/i,
  /^could not create booking:/i,
];

const BOOKING_CONFIRMATION_SUMMARY_PATTERNS = [
  /\b(booking|reservation|appointment)\b.*\b(confirmed|booked|scheduled)\b/i,
  /(бронь|бронирование|запись|резерв)[\s\S]{0,120}(подтвержден|подтверждена|создан|создана|оформлен|оформлена|забронирован|забронирована)/i,
  /(забронировал|забронировала|записал|записала|подтвердил|подтвердила)/i,
];

const CUSTOMER_VISIBLE_ACTION_PATTERNS = [
  ...BOOKING_SUCCESS_ACTION_PATTERNS,
  ...BOOKING_FAILURE_ACTION_PATTERNS,
  /task created:/i,
  /deal created:/i,
  /deal updated:/i,
  /contact created:/i,
];

export function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function stripBookingFailurePrefix(label: string): string {
  return label.replace(/^booking not (confirmed|created):\s*/i, "").trim();
}

export function isSoftDataCollectionBookingBlock(label: string): boolean {
  const reason = stripBookingFailurePrefix(normalizeText(label)).toLowerCase();
  return reason === "waiting for required customer data";
}

function localizeBookingFailureReason(reason: string, language: string): string {
  const key = reason.trim().toLowerCase();

  if (key === "waiting for required customer data") {
    if (language === "Russian") {
      return "нужны имя и телефон (или email) — напишите, пожалуйста, и я сразу оформлю запись";
    }
    if (language === "Uzbek") {
      return "ism va telefon (yoki email) kerak — yozing, darhol bron qilaman";
    }
    return "I need your name and phone (or email) to confirm the booking.";
  }

  return reason;
}

function hasBookingFailureWithoutSuccess(actionsApplied: string[]): boolean {
  const hasFailure = actionsApplied.some((label) =>
    BOOKING_FAILURE_ACTION_PATTERNS.some((pattern) => pattern.test(normalizeText(label))),
  );
  const hasSuccess = actionsApplied.some((label) =>
    BOOKING_SUCCESS_ACTION_PATTERNS.some((pattern) => pattern.test(normalizeText(label))),
  );

  return hasFailure && !hasSuccess;
}

export function summaryLooksLikeBookingConfirmation(summary: string): boolean {
  const normalized = normalizeText(summary);

  return BOOKING_CONFIRMATION_SUMMARY_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  );
}

export function looksLikeInternalAgentSummary(text: string): boolean {
  const normalized = normalizeText(text);

  if (!normalized) {
    return true;
  }

  return INTERNAL_SUMMARY_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function filterCustomerVisibleActionLabels(
  actionsApplied: string[],
): string[] {
  return actionsApplied.filter((label) => {
    const normalized = normalizeText(label);

    if (!normalized) {
      return false;
    }

    if (
      INTERNAL_ACTION_LABEL_PATTERNS.some((pattern) =>
        pattern.test(normalized),
      )
    ) {
      return false;
    }

    return CUSTOMER_VISIBLE_ACTION_PATTERNS.some((pattern) =>
      pattern.test(normalized),
    );
  });
}

export function hasCustomerVisibleOutcome(actionsApplied: string[]): boolean {
  return filterCustomerVisibleActionLabels(actionsApplied).length > 0;
}

export function sanitizeCustomerFacingSummary(
  summary: string | null | undefined,
): string | null {
  const normalized = normalizeText(summary ?? "");

  if (!normalized || looksLikeInternalAgentSummary(normalized)) {
    return null;
  }

  const guarded = sanitizeCustomerFacingReply(normalized, { fallback: null });

  return guarded.text;
}

export function messagesAreLikelyDuplicates(
  left: string,
  right: string,
): boolean {
  const a = normalizeText(left).toLowerCase();
  const b = normalizeText(right).toLowerCase();

  if (!a || !b) {
    return false;
  }

  if (a === b) {
    return true;
  }

  if (a.length >= 24 && (a.includes(b) || b.includes(a))) {
    return true;
  }

  // Short generic “I'll help you right now” variants should not both reach the customer.
  if (
    a.length <= 120 &&
    b.length <= 120 &&
    looksLikeGenericWaitingPhrase(a) &&
    looksLikeGenericWaitingPhrase(b)
  ) {
    return true;
  }

  return false;
}

function looksLikeGenericWaitingPhrase(text: string): boolean {
  return [
    /i('?ll| will) help you (right )?(now|here)/i,
    /help you right (now|here)/i,
    /помогу[\s\S]{0,80}(сейчас|прямо|здесь|чате)/i,
    /прямо сейчас[\s\S]{0,40}(здесь|помогу)/i,
    /shu yerda yordam/i,
    /hozir[\s\S]{0,40}yordam/i,
  ].some((pattern) => pattern.test(text));
}

export function shouldSendCustomerActionFollowUp(input: {
  actionsApplied: string[];
  clientSummary?: string | null;
}): boolean {
  const sanitizedSummary = sanitizeCustomerFacingSummary(input.clientSummary);
  const visibleActions = filterCustomerVisibleActionLabels(input.actionsApplied);
  const bookingFailure = hasBookingFailureWithoutSuccess(input.actionsApplied);
  const hasBookingSuccess = input.actionsApplied.some((label) =>
    BOOKING_SUCCESS_ACTION_PATTERNS.some((pattern) =>
      pattern.test(normalizeText(label)),
    ),
  );

  // Always notify customer when a booking attempt failed (except CRM data-collection soft blocks).
  if (bookingFailure) {
    const softBlockOnly = input.actionsApplied.every(
      (label) =>
        !BOOKING_FAILURE_ACTION_PATTERNS.some((pattern) =>
          pattern.test(normalizeText(label)),
        ) || isSoftDataCollectionBookingBlock(label),
    );

    if (softBlockOnly) {
      return false;
    }

    return true;
  }

  // Confirm only after a real calendar write.
  if (hasBookingSuccess) {
    return true;
  }

  // Drop false booking claims from orchestrator clientSummary.
  if (
    sanitizedSummary &&
    summaryLooksLikeBookingConfirmation(sanitizedSummary)
  ) {
    return false;
  }

  // Avoid a second customer message for CRM-only outcomes (deal/note/task)
  // — Phase-1 reply (or action-outcome context) should already cover them.
  if (sanitizedSummary && !hasCustomerVisibleOutcome(visibleActions)) {
    return false;
  }

  return false;
}

export function buildBookingFailureFollowUp(input: {
  language: string;
  actionsApplied: string[];
}): string | null {
  const failureLabel = input.actionsApplied.find((label) =>
    BOOKING_FAILURE_ACTION_PATTERNS.some((pattern) => pattern.test(normalizeText(label))),
  );

  if (!failureLabel) {
    return null;
  }

  const reason = stripBookingFailurePrefix(failureLabel);

  if (isSoftDataCollectionBookingBlock(failureLabel)) {
    return null;
  }

  const language = input.language.trim();
  const customerReason = localizeBookingFailureReason(reason, language);

  if (language === "Russian") {
    return customerReason
      ? `Пока не получилось подтвердить бронь: ${customerReason}`
      : "Пока не получилось подтвердить бронь. Предложу другой доступный вариант прямо здесь.";
  }

  if (language === "Uzbek") {
    return customerReason
      ? `Bronni tasdiqlab bo'lmadi: ${customerReason}`
      : "Bronni hozircha tasdiqlab bo'lmadi. Shu chatda boshqa mos variantni taklif qilaman.";
  }

  return customerReason
    ? `I could not confirm the booking yet: ${customerReason}`
    : "I could not confirm the booking yet. I will offer another available option right here.";
}
