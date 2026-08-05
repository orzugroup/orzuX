import "server-only";

import {
  findAvailableSlots,
  findNearestAvailableSlot,
  formatDateKeyInTimezone,
  formatSlotForDisplay,
  getMaxBookableDateKey,
  getTimezoneDayBounds,
  isIntervalFree,
  isWithinOperatingHours,
  mergeBusyIntervals,
  parseBookingDateTime,
  type OperatingHoursConfig,
  type TimeInterval,
} from "@/lib/calendar/slot-engine";
import {
  listGoogleCalendarEvents,
  queryGoogleCalendarFreeBusy,
} from "@/lib/google-calendar/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseEnv } from "@/lib/env";
import {
  getBusinessBookingSetup,
  listBusinessCalendarResources,
} from "@/services/business-calendar-setup.service";
import {
  getBookingPageByIdAdmin,
  getPublishedBookingPageBySlug,
} from "@/services/booking-pages.service";
import { listPublicBookingPageResources } from "@/services/business-calendar-resources.service";
import type { BookingPageRecord } from "@/types/booking-page.types";
import type { BusinessBookingSetup, BusinessCalendarResource } from "@/types/business-calendar-resource.types";
import type { GoogleCalendarConnection } from "@/types/database.types";

async function loadGoogleCalendarConnection(
  businessId: string,
): Promise<GoogleCalendarConnection | null> {
  if (!hasSupabaseEnv()) {
    return null;
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("google_calendar_connections")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data || data.google_calendar_status !== "connected" || !data.calendar_id) {
    return null;
  }

  return data;
}

async function resolveAccessToken(
  connection: GoogleCalendarConnection,
): Promise<string | null> {
  const { getGoogleCalendarAccessToken } = await import(
    "@/services/google-calendar.service"
  );

  return getGoogleCalendarAccessToken(connection);
}

function buildOperatingHoursFromSetup(
  setup: BusinessBookingSetup | null,
): OperatingHoursConfig {
  const schedule = setup?.weeklySchedule;
  const daySchedules: Record<number, { start: string; end: string }> = {};

  if (schedule) {
    for (const [dayKey, day] of Object.entries(schedule)) {
      if (day.enabled) {
        daySchedules[Number(dayKey)] = { start: day.start, end: day.end };
      }
    }
  }

  return {
    enabled: setup?.businessHoursEnabled ?? false,
    start: setup?.businessHoursStart ?? "09:00",
    end: setup?.businessHoursEnd ?? "18:00",
    timezone: setup?.bookingTimezone ?? "UTC",
    days: setup?.businessDays ?? [1, 2, 3, 4, 5],
    daySchedules: Object.keys(daySchedules).length > 0 ? daySchedules : undefined,
  };
}

function buildOperatingHoursFromBookingPage(
  page: BookingPageRecord,
): OperatingHoursConfig {
  const daySchedules: Record<number, { start: string; end: string }> = {};
  const enabledDays: number[] = [];

  for (const [dayKey, day] of Object.entries(page.weeklySchedule)) {
    if (day.enabled) {
      const dayNumber = Number(dayKey);
      daySchedules[dayNumber] = { start: day.start, end: day.end };
      enabledDays.push(dayNumber);
    }
  }

  return {
    enabled: enabledDays.length > 0,
    start: "09:00",
    end: "18:00",
    timezone: page.bookingTimezone,
    days: enabledDays,
    daySchedules,
  };
}

function matchResourceByName(
  resources: BusinessCalendarResource[],
  resourceName?: string | null,
): BusinessCalendarResource | null {
  if (!resourceName?.trim()) {
    return resources[0] ?? null;
  }

  const normalized = resourceName.trim().toLowerCase();

  return (
    resources.find((resource) => resource.name.toLowerCase() === normalized) ??
    resources.find((resource) =>
      normalized.includes(resource.name.toLowerCase()),
    ) ??
    resources.find((resource) =>
      resource.name.toLowerCase().includes(normalized),
    ) ??
    null
  );
}

async function getLocalBusyIntervals(input: {
  businessId: string;
  timeMin: Date;
  timeMax: Date;
  resourceId?: string | null;
}): Promise<TimeInterval[]> {
  if (!hasSupabaseEnv()) {
    return [];
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("calendar_events")
    .select("start_at, end_at, is_all_day, resource_id")
    .eq("business_id", input.businessId)
    .eq("is_booking", true)
    .lt("start_at", input.timeMax.toISOString())
    .gt("end_at", input.timeMin.toISOString());

  if (error || !data) {
    return [];
  }

  return data
    .filter((row) => {
      if (!input.resourceId) {
        return true;
      }

      return row.resource_id === input.resourceId;
    })
    .map((row) => {
      const start = new Date(row.start_at);
      const end = new Date(row.end_at);

      if (row.is_all_day) {
        end.setHours(23, 59, 59, 999);
      }

      return { start, end };
    })
    .filter(
      (interval) =>
        !Number.isNaN(interval.start.getTime()) &&
        !Number.isNaN(interval.end.getTime()),
    );
}

export async function getCalendarBusyIntervals(input: {
  businessId: string;
  timeMin: Date;
  timeMax: Date;
  resourceId?: string | null;
}): Promise<TimeInterval[]> {
  const localBusy = await getLocalBusyIntervals(input);

  if (input.resourceId) {
    return mergeBusyIntervals(localBusy);
  }

  const googleBusy = await getGoogleCalendarBusyIntervals(input);
  return mergeBusyIntervals([...localBusy, ...googleBusy]);
}

async function getGoogleCalendarBusyIntervals(input: {
  businessId: string;
  timeMin: Date;
  timeMax: Date;
}): Promise<TimeInterval[]> {
  const connection = await loadGoogleCalendarConnection(input.businessId);

  if (!connection?.calendar_id) {
    return [];
  }

  const accessToken = await resolveAccessToken(connection);

  if (!accessToken) {
    return [];
  }

  const timeMin = input.timeMin.toISOString();
  const timeMax = input.timeMax.toISOString();

  const freeBusy = await queryGoogleCalendarFreeBusy(
    accessToken,
    [connection.calendar_id],
    timeMin,
    timeMax,
  );

  if (freeBusy.busy.length > 0) {
    return freeBusy.busy;
  }

  const listed = await listGoogleCalendarEvents(
    accessToken,
    connection.calendar_id,
    timeMin,
    timeMax,
  );

  return listed.events
    .filter((event) => !event.isAllDay)
    .map((event) => ({
      start: new Date(event.start),
      end: new Date(event.end),
    }))
    .filter(
      (interval) =>
        !Number.isNaN(interval.start.getTime()) &&
        !Number.isNaN(interval.end.getTime()),
    );
}

function matchResourceFromSummary(
  resources: BusinessCalendarResource[],
  summary: string,
): BusinessCalendarResource | null {
  const normalizedSummary = summary.toLowerCase();

  for (const resource of resources) {
    if (normalizedSummary.includes(resource.name.toLowerCase())) {
      return resource;
    }
  }

  return resources[0] ?? null;
}

export async function findBookingPageSlotsForResource(input: {
  page: BookingPageRecord;
  resource: BusinessCalendarResource;
  date?: string;
  maxSlots?: number;
}): Promise<TimeInterval[]> {
  const daysAhead = input.page.advanceBookingDays;
  const operatingHours = buildOperatingHoursFromBookingPage(input.page);
  const durationMinutes = input.resource.durationMinutes ?? input.page.slotDurationMinutes;

  let windowStart = new Date();
  let windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + daysAhead);
  windowEnd.setHours(23, 59, 59, 999);

  if (input.date) {
    const dayBounds = getTimezoneDayBounds(input.date, input.page.bookingTimezone);
    windowStart = dayBounds.start;
    windowEnd = dayBounds.end;

    if (windowStart.getTime() < Date.now()) {
      windowStart = new Date();
    }
  }

  const busy = await getCalendarBusyIntervals({
    businessId: input.page.businessId,
    timeMin: windowStart,
    timeMax: windowEnd,
    resourceId: input.resource.id,
  });

  return findAvailableSlots({
    busy,
    windowStart,
    windowEnd,
    durationMinutes,
    stepMinutes: durationMinutes >= 120 ? 30 : 15,
    bufferMinutes: input.page.slotBufferMinutes,
    maxSlots: input.maxSlots ?? 24,
    operatingHours,
  });
}

export async function findBookingPageAvailableSlots(input: {
  page: BookingPageRecord;
  resources: BusinessCalendarResource[];
  maxSlots?: number;
  daysAhead?: number;
  date?: string;
}): Promise<TimeInterval[]> {
  const durationMinutes =
    input.resources[0]?.durationMinutes ?? input.page.slotDurationMinutes;
  const daysAhead = input.daysAhead ?? input.page.advanceBookingDays;
  const operatingHours = buildOperatingHoursFromBookingPage(input.page);

  let windowStart = new Date();
  let windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + daysAhead);
  windowEnd.setHours(23, 59, 59, 999);

  if (input.date) {
    const dayBounds = getTimezoneDayBounds(input.date, input.page.bookingTimezone);
    windowStart = dayBounds.start;
    windowEnd = dayBounds.end;

    if (windowStart.getTime() < Date.now()) {
      windowStart = new Date();
    }
  }

  const busy = await getCalendarBusyIntervals({
    businessId: input.page.businessId,
    timeMin: windowStart,
    timeMax: windowEnd,
  });

  return findAvailableSlots({
    busy,
    windowStart,
    windowEnd,
    durationMinutes,
    stepMinutes: durationMinutes >= 120 ? 30 : 15,
    bufferMinutes: input.page.slotBufferMinutes,
    maxSlots: input.maxSlots ?? (input.date ? 48 : 24),
    operatingHours,
  });
}

export async function getPublicBookingPageSlots(
  slug: string,
  options?: { date?: string; resourceId?: string },
) {
  const page = await getPublishedBookingPageBySlug(slug);

  if (!page) {
    return null;
  }

  const resources = await listPublicBookingPageResources(page.id);
  const todayKey = formatDateKeyInTimezone(new Date(), page.bookingTimezone);
  const maxBookableKey = getMaxBookableDateKey(
    page.bookingTimezone,
    page.advanceBookingDays,
  );

  let date = options?.date ?? todayKey;

  if (options?.date && !/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
    date = todayKey;
  }

  if (date < todayKey) {
    date = todayKey;
  }

  if (date > maxBookableKey) {
    date = maxBookableKey;
  }

  const resourceSlots = await Promise.all(
    resources.map(async (resource) => {
      const intervals = await findBookingPageSlotsForResource({
        page,
        resource,
        date,
        maxSlots: 24,
      });

      return {
        resourceId: resource.id,
        resourceName: resource.name,
        resourceType: resource.resourceType,
        durationMinutes: resource.durationMinutes,
        slots: intervals.map((slot) => ({
          start: slot.start.toISOString(),
          end: slot.end.toISOString(),
          label: formatSlotForDisplay(slot, page.bookingTimezone),
        })),
      };
    }),
  );

  const selectedResource = options?.resourceId
    ? resources.find((resource) => resource.id === options.resourceId)
    : null;

  const slots = selectedResource
    ? (resourceSlots.find((entry) => entry.resourceId === selectedResource.id)?.slots ?? [])
    : resourceSlots.flatMap((entry) => entry.slots);

  return {
    page,
    resources,
    selectedDate: date,
    resourceSlots,
    slots,
  };
}

export async function findBusinessAvailableSlots(input: {
  businessId: string;
  durationMinutes?: number;
  maxSlots?: number;
  daysAhead?: number;
}): Promise<TimeInterval[]> {
  const [setup, resources] = await Promise.all([
    getBusinessBookingSetup(input.businessId),
    listBusinessCalendarResources(input.businessId),
  ]);

  const durationMinutes =
    input.durationMinutes ??
    resources[0]?.durationMinutes ??
    setup?.slotDurationMinutes ??
    60;
  const daysAhead = input.daysAhead ?? setup?.advanceBookingDays ?? 14;

  const windowStart = new Date();
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + daysAhead);
  windowEnd.setHours(23, 59, 59, 999);

  const busy = await getCalendarBusyIntervals({
    businessId: input.businessId,
    timeMin: windowStart,
    timeMax: windowEnd,
  });

  return findAvailableSlots({
    busy,
    windowStart,
    windowEnd,
    durationMinutes,
    stepMinutes: durationMinutes >= 120 ? 30 : 15,
    bufferMinutes: setup?.slotBufferMinutes ?? 15,
    maxSlots: input.maxSlots ?? 12,
    operatingHours: buildOperatingHoursFromSetup(setup),
  });
}

export async function formatAvailabilityForAiPrompt(
  businessId: string,
): Promise<string> {
  const [setup, resources, slots] = await Promise.all([
    getBusinessBookingSetup(businessId),
    listBusinessCalendarResources(businessId),
    findBusinessAvailableSlots({
      businessId,
      maxSlots: 10,
      daysAhead: 7,
    }),
  ]);

  if (slots.length === 0) {
    return [
      "Live calendar availability: no open slots found in the next 7 days within business hours.",
      "If the customer gives a specific date/time, still use create_calendar_event — if that exact slot is unavailable, report alternatives; do not auto-book another day unless the customer agrees.",
    ].join("\n");
  }

  const timeZone = setup?.bookingTimezone ?? "UTC";
  const lines = slots.map(
    (slot) => `- ${formatSlotForDisplay(slot, timeZone)}`,
  );

  const defaultDuration =
    resources[0]?.durationMinutes != null
      ? `${resources[0].durationMinutes} minutes`
      : "60 minutes";

  return [
    "Live calendar availability (OrzuX events + Google Calendar FreeBusy):",
    ...lines,
    "",
    `Default appointment duration: ${defaultDuration}.`,
    setup?.businessHoursEnabled
      ? `Business hours: ${setup.businessHoursStart}–${setup.businessHoursEnd} (${timeZone}), days ${setup.businessDays.join(", ")}.`
      : "Business hours: not restricted in settings.",
    "When booking a short appointment, pick a slot from this list when possible.",
    "For multi-day stays (hotels / date ranges), set startDateTime = check-in and endDateTime = check-out — do NOT replace end with resource duration.",
  ].join("\n");
}

export type BookingSlotResolution =
  | {
      status: "available";
      startDateTime: string;
      endDateTime: string;
      resourceName: string | null;
    }
  | {
      status: "rescheduled";
      startDateTime: string;
      endDateTime: string;
      resourceName: string | null;
      originalStartDateTime: string;
    }
  | {
      status: "unavailable";
      reason: string;
      alternatives: string[];
    };

export async function resolveBookingSlot(input: {
  businessId: string;
  bookingPageId?: string;
  summary: string;
  startDateTime: string;
  endDateTime: string;
  timeZone: string;
  resourceId?: string | null;
  resourceName?: string | null;
  preferNearestSlot?: boolean;
}): Promise<BookingSlotResolution> {
  const bookingPage = input.bookingPageId
    ? await getBookingPageByIdAdmin(input.bookingPageId)
    : null;

  const [setup, resources] = await Promise.all([
    getBusinessBookingSetup(input.businessId),
    input.bookingPageId
      ? listPublicBookingPageResources(input.bookingPageId)
      : listBusinessCalendarResources(input.businessId),
  ]);

  const timeZone =
    input.timeZone?.trim() ||
    bookingPage?.bookingTimezone ||
    setup?.bookingTimezone ||
    "UTC";

  const start = parseBookingDateTime(input.startDateTime, timeZone);
  let end = parseBookingDateTime(input.endDateTime, timeZone);

  if (!start) {
    return {
      status: "unavailable",
      reason: "Invalid start date/time.",
      alternatives: [],
    };
  }

  const resource =
    (input.resourceId
      ? resources.find((item) => item.id === input.resourceId) ?? null
      : null) ??
    matchResourceByName(resources, input.resourceName) ??
    matchResourceFromSummary(resources, input.summary);

  const appointmentDurationMinutes =
    resource?.durationMinutes ??
    bookingPage?.slotDurationMinutes ??
    setup?.slotDurationMinutes ??
    60;

  if (!end || end.getTime() <= start.getTime()) {
    end = new Date(start.getTime() + appointmentDurationMinutes * 60 * 1000);
  }

  const requestedSpanMs = end.getTime() - start.getTime();
  const isMultiDayStay = requestedSpanMs >= 12 * 60 * 60 * 1000;
  const durationMinutes = isMultiDayStay
    ? Math.max(Math.round(requestedSpanMs / 60_000), appointmentDurationMinutes)
    : appointmentDurationMinutes;

  const candidate: TimeInterval = { start, end };
  const daysAhead =
    bookingPage?.advanceBookingDays ?? setup?.advanceBookingDays ?? 14;
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + Math.max(daysAhead, isMultiDayStay ? 60 : daysAhead));
  windowEnd.setHours(23, 59, 59, 999);

  const bufferMinutes =
    bookingPage?.slotBufferMinutes ?? setup?.slotBufferMinutes ?? 15;
  const bufferMs = bufferMinutes * 60 * 1000;
  const busy = await getCalendarBusyIntervals({
    businessId: input.businessId,
    timeMin: new Date(candidate.start.getTime() - bufferMs),
    timeMax: new Date(Math.max(candidate.end.getTime() + bufferMs, windowEnd.getTime())),
    resourceId: resource?.id ?? null,
  });

  const operatingHours = bookingPage
    ? buildOperatingHoursFromBookingPage(bookingPage)
    : buildOperatingHoursFromSetup(setup);

  // Multi-day stays (hotel check-in → check-out): only validate check-in day hours.
  // Checking the check-out midnight against business hours collapses ranges incorrectly.
  const withinHours =
    !operatingHours.enabled ||
    (isMultiDayStay
      ? isWithinOperatingHours(candidate.start, operatingHours)
      : isWithinOperatingHours(candidate.start, operatingHours) &&
        isWithinOperatingHours(
          new Date(candidate.end.getTime() - 60_000),
          operatingHours,
        ));
  const isFree = isIntervalFree(candidate, busy, bufferMinutes);

  if (isFree && withinHours) {
    return {
      status: "available",
      startDateTime: candidate.start.toISOString(),
      endDateTime: candidate.end.toISOString(),
      resourceName: resource?.name ?? null,
    };
  }

  if (input.preferNearestSlot !== false) {
    if (isMultiDayStay) {
      const stayMs = requestedSpanMs;
      for (let dayOffset = 1; dayOffset <= 21; dayOffset += 1) {
        const shiftedStart = new Date(start.getTime() + dayOffset * 86_400_000);
        const shiftedEnd = new Date(shiftedStart.getTime() + stayMs);
        const shifted: TimeInterval = { start: shiftedStart, end: shiftedEnd };
        const shiftedWithinHours =
          !operatingHours.enabled ||
          isWithinOperatingHours(shiftedStart, operatingHours);
        if (
          shiftedWithinHours &&
          isIntervalFree(shifted, busy, bufferMinutes)
        ) {
          return {
            status: "rescheduled",
            startDateTime: shiftedStart.toISOString(),
            endDateTime: shiftedEnd.toISOString(),
            resourceName: resource?.name ?? null,
            originalStartDateTime: candidate.start.toISOString(),
          };
        }
      }
    } else {
      const nearest = findNearestAvailableSlot({
        requestedStart: start,
        durationMinutes,
        busy,
        windowEnd,
        bufferMinutes,
        operatingHours,
      });

      if (nearest) {
        return {
          status: "rescheduled",
          startDateTime: nearest.start.toISOString(),
          endDateTime: nearest.end.toISOString(),
          resourceName: resource?.name ?? null,
          originalStartDateTime: candidate.start.toISOString(),
        };
      }
    }
  }

  const alternatives = (
    isMultiDayStay
      ? (() => {
          const labels: string[] = [];
          const stayMs = requestedSpanMs;
          for (let dayOffset = 0; dayOffset <= 21 && labels.length < 5; dayOffset += 1) {
            const shiftedStart = new Date(start.getTime() + dayOffset * 86_400_000);
            const shiftedEnd = new Date(shiftedStart.getTime() + stayMs);
            if (
              (!operatingHours.enabled ||
                isWithinOperatingHours(shiftedStart, operatingHours)) &&
              isIntervalFree(
                { start: shiftedStart, end: shiftedEnd },
                busy,
                bufferMinutes,
              )
            ) {
              labels.push(
                formatSlotForDisplay(
                  { start: shiftedStart, end: shiftedEnd },
                  timeZone,
                ),
              );
            }
          }
          return labels;
        })()
      : findAvailableSlots({
          busy,
          windowStart: start,
          windowEnd,
          durationMinutes,
          stepMinutes: 15,
          bufferMinutes,
          maxSlots: 5,
          operatingHours,
        }).map((slot) => formatSlotForDisplay(slot, timeZone))
  );

  return {
    status: "unavailable",
    reason: !isFree
      ? resource?.name
        ? `${resource.name} is already booked at this time.`
        : "Requested time overlaps an existing booking."
      : "Requested time is outside business hours.",
    alternatives,
  };
}

export type BookingSlotCheckResult = {
  available: boolean;
  message?: string;
  field?: "resource" | "time";
  alternatives?: string[];
};

export async function checkBookingSlotAvailability(input: {
  businessId: string;
  bookingPageId?: string;
  startDateTime: string;
  endDateTime: string;
  timeZone: string;
  resourceId?: string | null;
  resourceName?: string | null;
}): Promise<BookingSlotCheckResult> {
  const resolution = await resolveBookingSlot({
    businessId: input.businessId,
    bookingPageId: input.bookingPageId,
    summary: "availability-check",
    startDateTime: input.startDateTime,
    endDateTime: input.endDateTime,
    timeZone: input.timeZone,
    resourceId: input.resourceId ?? null,
    resourceName: input.resourceName ?? null,
    preferNearestSlot: false,
  });

  if (resolution.status === "available") {
    return { available: true };
  }

  const alternatives =
    resolution.status === "unavailable" ? resolution.alternatives : [];
  const reason =
    resolution.status === "unavailable"
      ? resolution.reason
      : "This time is no longer available.";
  const isResourceConflict =
    reason.includes("already booked") || reason.includes("overlaps an existing booking");
  const field: "resource" | "time" = isResourceConflict ? "resource" : "time";
  const message =
    alternatives.length > 0
      ? `${reason} Try: ${alternatives.slice(0, 3).join(", ")}`
      : reason;

  return {
    available: false,
    message,
    field,
    alternatives,
  };
}

export async function getCalendarAvailabilityPageData(businessId: string) {
  const [setup, resources, slots] = await Promise.all([
    getBusinessBookingSetup(businessId),
    listBusinessCalendarResources(businessId),
    findBusinessAvailableSlots({
      businessId,
      maxSlots: 8,
    }),
  ]);

  const timeZone = setup?.bookingTimezone ?? "UTC";

  return {
    setup,
    resources,
    slots: slots.map((slot) => ({
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
      label: formatSlotForDisplay(slot, timeZone),
    })),
    timeZone,
  };
}
