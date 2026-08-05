"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ORZUX_CALENDAR_MESSAGES } from "@/features/google-calendar/orzux-calendar-messages";
import {
  addDaysToDateKey,
  formatDateKeyInTimezone,
  getMaxBookableDateKey,
  getTimezoneDayBounds,
} from "@/lib/calendar/slot-engine";
import type { WeeklySchedule } from "@/lib/calendar/weekly-schedule";
import { cn } from "@/lib/utils";

type PublicBookingCalendarProps = {
  timeZone: string;
  weeklySchedule: WeeklySchedule;
  advanceBookingDays: number;
  selectedDate: string;
  onSelectDate: (dateKey: string) => void;
};

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getZonedDayOfWeek(instant: Date, timeZone: string): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(instant);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? 0;
}

function monthStartFromDateKey(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
}

function shiftMonthStart(monthStartKey: string, deltaMonths: number): string {
  const year = Number.parseInt(monthStartKey.slice(0, 4), 10);
  const month = Number.parseInt(monthStartKey.slice(5, 7), 10);
  const shifted = new Date(Date.UTC(year, month - 1 + deltaMonths, 1));

  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function buildMonthGrid(monthStartKey: string, timeZone: string): string[] {
  const firstDayOffset = getZonedDayOfWeek(
    getTimezoneDayBounds(monthStartKey, timeZone).start,
    timeZone,
  );
  const gridStart = addDaysToDateKey(monthStartKey, -firstDayOffset, timeZone);

  const cells: string[] = [];
  let current = gridStart;

  for (let index = 0; index < 42; index += 1) {
    cells.push(current);
    current = addDaysToDateKey(current, 1, timeZone);
  }

  return cells;
}

function isDateBookable(
  dateKey: string,
  timeZone: string,
  weeklySchedule: WeeklySchedule,
  advanceBookingDays: number,
): boolean {
  const todayKey = formatDateKeyInTimezone(new Date(), timeZone);
  const maxKey = getMaxBookableDateKey(timeZone, advanceBookingDays);

  if (dateKey < todayKey || dateKey > maxKey) {
    return false;
  }

  const dayOfWeek = getZonedDayOfWeek(getTimezoneDayBounds(dateKey, timeZone).start, timeZone);
  return weeklySchedule[dayOfWeek]?.enabled ?? false;
}

function firstBookableDateInMonth(
  monthStartKey: string,
  timeZone: string,
  weeklySchedule: WeeklySchedule,
  advanceBookingDays: number,
): string | null {
  const grid = buildMonthGrid(monthStartKey, timeZone);

  for (const dateKey of grid) {
    if (!dateKey.startsWith(monthStartKey.slice(0, 7))) {
      continue;
    }

    if (isDateBookable(dateKey, timeZone, weeklySchedule, advanceBookingDays)) {
      return dateKey;
    }
  }

  return null;
}

export function PublicBookingCalendar({
  timeZone,
  weeklySchedule,
  advanceBookingDays,
  selectedDate,
  onSelectDate,
}: PublicBookingCalendarProps) {
  const [visibleMonth, setVisibleMonth] = useState(() =>
    monthStartFromDateKey(selectedDate),
  );

  const maxBookableKey = useMemo(
    () => getMaxBookableDateKey(timeZone, advanceBookingDays),
    [timeZone, advanceBookingDays],
  );

  useEffect(() => {
    setVisibleMonth(monthStartFromDateKey(selectedDate));
  }, [selectedDate]);

  const monthLabel = useMemo(() => {
    const { start } = getTimezoneDayBounds(visibleMonth, timeZone);
    return start.toLocaleDateString(undefined, {
      timeZone,
      month: "long",
      year: "numeric",
    });
  }, [visibleMonth, timeZone]);

  const grid = useMemo(
    () => buildMonthGrid(visibleMonth, timeZone),
    [visibleMonth, timeZone],
  );

  const visibleMonthPrefix = visibleMonth.slice(0, 7);
  const canGoPrev = visibleMonth > monthStartFromDateKey(formatDateKeyInTimezone(new Date(), timeZone));
  const canGoNext = visibleMonth < monthStartFromDateKey(maxBookableKey);

  function goPrevMonth() {
    if (!canGoPrev) return;

    const prevMonth = shiftMonthStart(visibleMonth, -1);
    setVisibleMonth(prevMonth);

    const firstBookable = firstBookableDateInMonth(
      prevMonth,
      timeZone,
      weeklySchedule,
      advanceBookingDays,
    );

    if (firstBookable) {
      onSelectDate(firstBookable);
    }
  }

  function goNextMonth() {
    if (!canGoNext) return;

    const nextMonth = shiftMonthStart(visibleMonth, 1);
    setVisibleMonth(nextMonth);

    const firstBookable = firstBookableDateInMonth(
      nextMonth,
      timeZone,
      weeklySchedule,
      advanceBookingDays,
    );

    if (firstBookable) {
      onSelectDate(firstBookable);
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-medium">{ORZUX_CALENDAR_MESSAGES.publicBookSelectDate}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-md border bg-background hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            onClick={goPrevMonth}
            disabled={!canGoPrev}
            aria-label={ORZUX_CALENDAR_MESSAGES.prevMonth}
          >
            <ChevronLeftIcon className="size-4" />
          </button>
          <span className="min-w-[120px] text-center text-sm font-medium">{monthLabel}</span>
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-md border bg-background hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            onClick={goNextMonth}
            disabled={!canGoNext}
            aria-label={ORZUX_CALENDAR_MESSAGES.nextMonth}
          >
            <ChevronRightIcon className="size-4" />
          </button>
        </div>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        {ORZUX_CALENDAR_MESSAGES.publicBookAdvanceWindow.replace(
          "{days}",
          String(advanceBookingDays),
        )}
      </p>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
        {WEEKDAY_HEADERS.map((label) => (
          <div key={label} className="py-1">
            {label}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {grid.map((dateKey) => {
          const dayNumber = Number.parseInt(dateKey.slice(8, 10), 10);
          const inMonth = dateKey.startsWith(visibleMonthPrefix);
          const bookable = isDateBookable(
            dateKey,
            timeZone,
            weeklySchedule,
            advanceBookingDays,
          );
          const isSelected = dateKey === selectedDate;
          const todayKey = formatDateKeyInTimezone(new Date(), timeZone);
          const isToday = dateKey === todayKey;

          return (
            <button
              key={dateKey}
              type="button"
              disabled={!bookable}
              title={
                !bookable
                  ? dateKey < todayKey
                    ? ORZUX_CALENDAR_MESSAGES.publicBookPastDate
                    : dateKey > maxBookableKey
                      ? ORZUX_CALENDAR_MESSAGES.publicBookTooFarAhead
                      : ORZUX_CALENDAR_MESSAGES.publicBookClosedDay
                  : undefined
              }
              className={cn(
                "flex h-10 items-center justify-center rounded-lg text-sm transition-colors",
                !inMonth && "text-muted-foreground/40",
                bookable && !isSelected && "hover:bg-muted",
                !bookable &&
                  "cursor-not-allowed text-muted-foreground/35 line-through decoration-muted-foreground/30",
                isSelected && "bg-primary font-semibold text-primary-foreground hover:bg-primary",
                isToday && !isSelected && bookable && "ring-1 ring-primary/40",
              )}
              onClick={() => bookable && onSelectDate(dateKey)}
            >
              {dayNumber}
            </button>
          );
        })}
      </div>
    </div>
  );
}
