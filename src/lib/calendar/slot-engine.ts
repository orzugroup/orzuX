export type TimeInterval = {
  start: Date;
  end: Date;
};

export type OperatingHoursConfig = {
  enabled: boolean;
  start: string;
  end: string;
  timezone: string;
  days: number[];
  daySchedules?: Record<number, { start: string; end: string }>;
};

function parseTimeToMinutes(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return null;
  }

  const hours = Number.parseInt(match[1] ?? "0", 10);
  const minutes = Number.parseInt(match[2] ?? "0", 10);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Mon";
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    dayOfWeek: dayMap[weekday] ?? 0,
    hour: Number.parseInt(parts.find((part) => part.type === "hour")?.value ?? "0", 10),
    minute: Number.parseInt(
      parts.find((part) => part.type === "minute")?.value ?? "0",
      10,
    ),
    year: Number.parseInt(parts.find((part) => part.type === "year")?.value ?? "0", 10),
    month: Number.parseInt(parts.find((part) => part.type === "month")?.value ?? "0", 10),
    day: Number.parseInt(parts.find((part) => part.type === "day")?.value ?? "0", 10),
  };
}

export function isWithinOperatingHours(
  date: Date,
  config: OperatingHoursConfig,
): boolean {
  if (!config.enabled) {
    return true;
  }

  const parts = getZonedParts(date, config.timezone || "UTC");

  if (!config.days.includes(parts.dayOfWeek)) {
    return false;
  }

  const daySchedule = config.daySchedules?.[parts.dayOfWeek];
  const startMinutes = parseTimeToMinutes(daySchedule?.start ?? config.start);
  const endMinutes = parseTimeToMinutes(daySchedule?.end ?? config.end);

  if (startMinutes == null || endMinutes == null) {
    return true;
  }

  const currentMinutes = parts.hour * 60 + parts.minute;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

export function intervalsOverlap(
  a: TimeInterval,
  b: TimeInterval,
  bufferMinutes = 0,
): boolean {
  const bufferMs = bufferMinutes * 60 * 1000;

  return (
    a.start.getTime() - bufferMs < b.end.getTime() &&
    a.end.getTime() + bufferMs > b.start.getTime()
  );
}

export function mergeBusyIntervals(intervals: TimeInterval[]): TimeInterval[] {
  const valid = intervals
    .filter(
      (interval) =>
        !Number.isNaN(interval.start.getTime()) &&
        !Number.isNaN(interval.end.getTime()) &&
        interval.end.getTime() > interval.start.getTime(),
    )
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: TimeInterval[] = [];

  for (const interval of valid) {
    const last = merged[merged.length - 1];

    if (!last || interval.start.getTime() > last.end.getTime()) {
      merged.push({ start: interval.start, end: interval.end });
      continue;
    }

    if (interval.end.getTime() > last.end.getTime()) {
      last.end = interval.end;
    }
  }

  return merged;
}

export function isIntervalFree(
  candidate: TimeInterval,
  busy: TimeInterval[],
  bufferMinutes = 0,
): boolean {
  return !busy.some((block) => intervalsOverlap(candidate, block, bufferMinutes));
}

export function findAvailableSlots(input: {
  busy: TimeInterval[];
  windowStart: Date;
  windowEnd: Date;
  durationMinutes: number;
  stepMinutes?: number;
  bufferMinutes?: number;
  maxSlots?: number;
  operatingHours?: OperatingHoursConfig;
}): TimeInterval[] {
  const stepMinutes = input.stepMinutes ?? 30;
  const bufferMinutes = input.bufferMinutes ?? 0;
  const maxSlots = input.maxSlots ?? 12;
  const durationMs = input.durationMinutes * 60 * 1000;
  const stepMs = stepMinutes * 60 * 1000;
  const slots: TimeInterval[] = [];

  let cursor = new Date(input.windowStart);

  while (cursor.getTime() + durationMs <= input.windowEnd.getTime()) {
    const candidate: TimeInterval = {
      start: new Date(cursor),
      end: new Date(cursor.getTime() + durationMs),
    };

    const withinHours = input.operatingHours
      ? isWithinOperatingHours(candidate.start, input.operatingHours) &&
        isWithinOperatingHours(
          new Date(candidate.end.getTime() - 60_000),
          input.operatingHours,
        )
      : true;

    if (
      withinHours &&
      candidate.start.getTime() >= Date.now() &&
      isIntervalFree(candidate, input.busy, bufferMinutes)
    ) {
      slots.push(candidate);

      if (slots.length >= maxSlots) {
        break;
      }
    }

    cursor = new Date(cursor.getTime() + stepMs);
  }

  return slots;
}

export function findNearestAvailableSlot(input: {
  requestedStart: Date;
  durationMinutes: number;
  busy: TimeInterval[];
  windowEnd: Date;
  bufferMinutes?: number;
  operatingHours?: OperatingHoursConfig;
}): TimeInterval | null {
  const slots = findAvailableSlots({
    busy: input.busy,
    windowStart: input.requestedStart,
    windowEnd: input.windowEnd,
    durationMinutes: input.durationMinutes,
    stepMinutes: 15,
    bufferMinutes: input.bufferMinutes,
    maxSlots: 1,
    operatingHours: input.operatingHours,
  });

  if (slots[0]) {
    return slots[0];
  }

  const earlierSlots = findAvailableSlots({
    busy: input.busy,
    windowStart: new Date(),
    windowEnd: input.requestedStart,
    durationMinutes: input.durationMinutes,
    stepMinutes: 15,
    bufferMinutes: input.bufferMinutes,
    maxSlots: 48,
    operatingHours: input.operatingHours,
  });

  const before = [...earlierSlots]
    .reverse()
    .find((slot) => slot.end.getTime() <= input.requestedStart.getTime());

  return before ?? null;
}

export function parseIsoDateTime(value: string): Date | null {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

/**
 * Parse AI/booking datetimes in a business IANA timezone.
 * - `YYYY-MM-DD` → local midnight in `timeZone` (avoids UTC date-only +1 day bugs)
 * - `YYYY-MM-DDTHH:mm[:ss]` without offset → wall clock in `timeZone`
 * - values with `Z` or ±offset → absolute instant
 */
export function parseBookingDateTime(
  value: string,
  timeZone: string,
): Date | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const dateOnly = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const year = Number.parseInt(dateOnly[1] ?? "0", 10);
    const month = Number.parseInt(dateOnly[2] ?? "0", 10);
    const day = Number.parseInt(dateOnly[3] ?? "0", 10);
    return findUtcForLocalDateTime(year, month, day, 0, 0, timeZone);
  }

  const hasExplicitOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  if (hasExplicitOffset) {
    return parseIsoDateTime(trimmed);
  }

  const localMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/,
  );
  if (localMatch) {
    const year = Number.parseInt(localMatch[1] ?? "0", 10);
    const month = Number.parseInt(localMatch[2] ?? "0", 10);
    const day = Number.parseInt(localMatch[3] ?? "0", 10);
    const hour = Number.parseInt(localMatch[4] ?? "0", 10);
    const minute = Number.parseInt(localMatch[5] ?? "0", 10);
    return findUtcForLocalDateTime(year, month, day, hour, minute, timeZone);
  }

  return parseIsoDateTime(trimmed);
}

export function formatSlotForDisplay(
  slot: TimeInterval,
  timeZone: string,
  locale = "en-US",
): string {
  const startFormatter = new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const spanMs = slot.end.getTime() - slot.start.getTime();
  if (spanMs >= 12 * 60 * 60 * 1000) {
    const dayFormatter = new Intl.DateTimeFormat(locale, {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    return `${dayFormatter.format(slot.start)} → ${dayFormatter.format(slot.end)}`;
  }

  return startFormatter.format(slot.start);
}

function findUtcForLocalDateTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const targetDay = year * 10_000 + month * 100 + day;
  const targetMinutes = hour * 60 + minute;

  let low = Date.UTC(year, month - 1, day - 1);
  let high = Date.UTC(year, month - 1, day + 2);

  for (let attempt = 0; attempt < 48; attempt += 1) {
    const mid = Math.floor((low + high) / 2);
    const parts = getZonedParts(new Date(mid), timeZone);
    const currentDay = parts.year * 10_000 + parts.month * 100 + parts.day;
    const currentMinutes = parts.hour * 60 + parts.minute;

    if (
      currentDay < targetDay ||
      (currentDay === targetDay && currentMinutes < targetMinutes)
    ) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return new Date(high);
}

/** UTC bounds for a calendar day (YYYY-MM-DD) in the given IANA timezone. */
export function getTimezoneDayBounds(
  dateStr: string,
  timeZone: string,
): TimeInterval {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    const fallback = new Date();
    return { start: fallback, end: fallback };
  }

  const year = Number.parseInt(match[1] ?? "0", 10);
  const month = Number.parseInt(match[2] ?? "0", 10);
  const day = Number.parseInt(match[3] ?? "0", 10);

  const start = findUtcForLocalDateTime(year, month, day, 0, 0, timeZone);
  const end = findUtcForLocalDateTime(year, month, day, 23, 59, timeZone);
  end.setSeconds(59, 999);

  return { start, end };
}

export function formatDateKeyInTimezone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

/** Advance a YYYY-MM-DD key by calendar days in `timeZone` (matches public booking UI). */
export function addDaysToDateKey(dateKey: string, days: number, timeZone: string): string {
  let current = dateKey;
  const step = days >= 0 ? 1 : -1;

  for (let index = 0; index < Math.abs(days); index += 1) {
    const bounds = getTimezoneDayBounds(current, timeZone);
    const nextInstant = new Date(
      (step > 0 ? bounds.end.getTime() : bounds.start.getTime()) + step,
    );
    current = formatDateKeyInTimezone(nextInstant, timeZone);
  }

  return current;
}

export function getMaxBookableDateKey(timeZone: string, advanceBookingDays: number): string {
  const todayKey = formatDateKeyInTimezone(new Date(), timeZone);
  return addDaysToDateKey(todayKey, advanceBookingDays, timeZone);
}
