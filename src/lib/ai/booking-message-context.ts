export type BookingConversationTurn = {
  role: "user" | "assistant";
  content: string;
};

const BOOKING_OR_ORDER_PATTERNS = [
  /\b(book|booking|reserve|reservation|appointment|schedule|order|check[- ]?in|check[- ]?out|room|table|slot)\b/i,
  /\b(брон|заброн|брони|резерв|запис|заказ|номер|комнат|столик|заезд|выезд|свободн|консультац)/i,
  /\b(bron|band|xona|stol|buyurtma|navbat|uchrashuv)/i,
];

const SLOT_SELECTION_PATTERNS = [
  /^(мне\s+)?(подходит|беру|выбираю|давайте|давай|ок|ok|yes|да|хорошо)\b/i,
  /^\d{1,2}([:.]\d{2})?\s*$/,
  /\b(в\s+)?\d{1,2}([:.]\d{2})?\b/i,
  /\b(на\s+)?(завтра|послезавтра|сегодня)\b/i,
  /\b(на\s+)?\d{1,2}\s+(январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)/i,
  /\b(январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)[а-я]*\s+(на\s+)?\d{1,2}/i,
  /\d{1,2}[./]\d{1,2}([./]\d{2,4})?/,
];

const EXPLICIT_DATETIME_PATTERNS = [
  /\d{1,2}\s*:\s*\d{2}/,
  /\b\d{4}-\d{2}-\d{2}/,
  /\b(на\s+)?\d{1,2}\s+(январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)/i,
  /\b(январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)[а-я]*\s+(на\s+)?\d{1,2}/i,
  /\d{1,2}[./]\d{1,2}([./]\d{2,4})?/,
  /\b(на\s+)?(завтра|послезавтра|сегодня)\b.*\d{1,2}/i,
];

const BOOKING_CANCEL_PATTERNS = [
  /\b(cancel|cancellation)\b.*\b(book|appointment|reservation)/i,
  /(отмен|отменить|отмена|отменяю).*(брон|запис|консультац|встреч)/i,
  /(брон|запис|консультац|встреч).*(отмен|отменить|не\s+нужн|не\s+буду|не\s+приду)/i,
  /не\s+хочу\s+(консультац|брон|запис|встреч)/i,
  /(хочу\s+)?(отменить|отмена)\s+(брон|запис)/i,
  /отметить\s+бронир/i,
];

const BOOKING_RESCHEDULE_PATTERNS = [
  /(перенест|перенос|перенес|перенести|reschedule|move).*(брон|запис|консультац|встреч|appointment)/i,
  /(брон|запис|консультац).*(перенест|другое\s+время|другую\s+дату)/i,
];

const ASSISTANT_BOOKING_CONTEXT_PATTERNS = [
  /\b(слот|время|вариант|запис|консультац|appointment|available|10:00|12:00|14:00)\b/i,
  /какое время/i,
  /what time/i,
];

function recentAssistantText(
  history: BookingConversationTurn[] | undefined,
  maxTurns = 4,
): string {
  if (!history?.length) {
    return "";
  }

  return history
    .slice(-maxTurns)
    .filter((turn) => turn.role === "assistant")
    .map((turn) => turn.content)
    .join("\n");
}

export function isLikelyBookingOrOrderMessage(message: string): boolean {
  const trimmed = message.trim();

  if (!trimmed) {
    return false;
  }

  return BOOKING_OR_ORDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/** Booking intent or slot/time reply in an ongoing booking thread. */
export function isBookingRelatedTurn(
  message: string,
  conversationHistory?: BookingConversationTurn[],
): boolean {
  if (isLikelyBookingOrOrderMessage(message)) {
    return true;
  }

  const trimmed = message.trim();

  if (!trimmed) {
    return false;
  }

  const assistantContext = recentAssistantText(conversationHistory);

  if (
    assistantContext &&
    ASSISTANT_BOOKING_CONTEXT_PATTERNS.some((pattern) =>
      pattern.test(assistantContext),
    )
  ) {
    if (
      SLOT_SELECTION_PATTERNS.some((pattern) => pattern.test(trimmed)) ||
      trimmed.length <= 48
    ) {
      return true;
    }
  }

  return SLOT_SELECTION_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function isExplicitCustomerBookingDateTime(message: string): boolean {
  const trimmed = message.trim();

  if (!trimmed) {
    return false;
  }

  return EXPLICIT_DATETIME_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function isBookingManagementTurn(
  message: string,
  conversationHistory?: BookingConversationTurn[],
): boolean {
  const trimmed = message.trim();

  if (!trimmed) {
    return false;
  }

  if (BOOKING_CANCEL_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return true;
  }

  if (BOOKING_RESCHEDULE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return true;
  }

  const assistantContext = recentAssistantText(conversationHistory);

  if (
    assistantContext &&
    /(перенест|новое\s+время|новую\s+дату|reschedule|какое\s+новое)/i.test(
      assistantContext,
    ) &&
    (isExplicitCustomerBookingDateTime(trimmed) ||
      SLOT_SELECTION_PATTERNS.some((pattern) => pattern.test(trimmed)))
  ) {
    return true;
  }

  return false;
}

export function shouldRunBookingOrchestrationBeforeReply(
  message: string,
  conversationHistory?: BookingConversationTurn[],
): boolean {
  return (
    isBookingRelatedTurn(message, conversationHistory) ||
    isBookingManagementTurn(message, conversationHistory)
  );
}

export function hasBookingRescheduleOrCancelAction(
  actionsApplied: string[],
): boolean {
  return actionsApplied.some((label) => {
    const normalized = label.trim();
    return (
      /^cancelled:/i.test(normalized) ||
      /^rescheduled:/i.test(normalized) ||
      /^booking (rescheduled|cancelled)/i.test(normalized)
    );
  });}

export function looksLikeFalseBookingReschedule(text: string): boolean {
  const trimmed = text.trim();

  if (!trimmed) {
    return false;
  }

  return [
    /(перенес(ен|ено|ла|ли)|перенесён|перенесена)/i,
    /(бронь|запись|консультац).*(перенес)/i,
    /(appointment|booking).*(rescheduled|moved)/i,
    /(отмен(ен|ена|ено|ил)|отменил).*(брон|запис)/i,
    /(бронь|запись).*(отмен)/i,
  ].some((pattern) => pattern.test(trimmed));
}

export function hasBookingConfirmedAction(actionsApplied: string[]): boolean {
  return actionsApplied.some((label) =>
    /^booking confirmed/i.test(label.trim()),
  );
}

export function looksLikeFalseBookingConfirmation(text: string): boolean {
  const trimmed = text.trim();

  if (!trimmed) {
    return false;
  }

  return [
    /(я\s+)?(записал|забронировал|оформил\s+запись)/i,
    /(вы\s+)?(записан|забронирован)/i,
    /жд[её]м\s+вас/i,
    /бронь\s+подтвержден/i,
    /(appointment|booking)\s+(is\s+)?confirmed/i,
    /you\s+are\s+(booked|scheduled)/i,
    /i('ve|\s+have)\s+booked/i,
  ].some((pattern) => pattern.test(trimmed));
}
