import type { DoctorAvailability, DoctorLeave } from '@prisma/client';
import { weekdayForDate } from '../../utils/weekday.js';
import { startOfDay } from '../../utils/date.js';
import { timeMinutes } from '../../utils/time.util.js';

/** `DoctorLeave.startDate`/`endDate` are `@db.Date` columns, which this codebase always reads and
 * compares as UTC-midnight values (see booking.availability.ts's `holidayDateKey` for the exact
 * same convention) — never as local-midnight `Date` objects. Comparing a local-midnight `day`
 * value directly against these would be silently wrong on any positive-UTC-offset server: a leave
 * stored for "2026-08-18" round-trips as `2026-08-18T00:00:00Z`, which is already several hours
 * past local midnight on that date. */
function toUtcDateKey(day: Date): Date {
  return new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()));
}

function isOnLeave(day: Date, leaves: DoctorLeave[]): boolean {
  const key = toUtcDateKey(day);
  return leaves.some((l) => l.startDate <= key && l.endDate >= key);
}

/**
 * Utilization = booked/consultation workload ÷ available working capacity, both measured in
 * minutes over [start, end).
 *
 *   availableCapacityMinutes = Σ over each calendar day in range, for each active
 *     DoctorAvailability session whose weekday matches that day (and the day is not covered by a
 *     DoctorLeave), of (endTime − startTime) in minutes.
 *
 *   utilization = bookedMinutes / availableCapacityMinutes
 *
 * If availableCapacityMinutes is 0 (no active availability template for any weekday in range, or
 * every matching day is on leave), utilization is `null` — NOT 0. A `null` means "there was no
 * scheduled capacity to measure against for this period" (data-not-applicable); `0` would wrongly
 * imply capacity existed and the doctor did zero work against it. Division by zero never occurs.
 *
 * The day-by-day loop is bounded by the caller's date range (capped at 366 days for custom ranges
 * — see analytics.util.ts), so this is a small, cheap in-memory loop, not a "recalculate huge
 * datasets" anti-pattern — the actual heavy data (availability templates, leaves) is fetched once
 * per doctor via two bounded queries before this runs.
 */
export function computeAvailableCapacityMinutes(start: Date, end: Date, templates: DoctorAvailability[], leaves: DoctorLeave[]): { capacityMinutes: number; leaveDays: number } {
  let capacityMinutes = 0;
  let leaveDays = 0;
  const cursor = startOfDay(start);
  const rangeEnd = startOfDay(end);
  while (cursor < rangeEnd) {
    const day = new Date(cursor);
    const weekday = weekdayForDate(day);
    const onLeave = isOnLeave(day, leaves);
    if (onLeave) {
      if (templates.some((t) => t.weekday === weekday)) leaveDays += 1;
    } else {
      for (const t of templates) {
        if (t.weekday !== weekday) continue;
        capacityMinutes += timeMinutes(t.endTime) - timeMinutes(t.startTime);
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return { capacityMinutes, leaveDays };
}

export function computeUtilization(bookedMinutes: number, capacityMinutes: number): number | null {
  if (capacityMinutes <= 0) return null;
  return bookedMinutes / capacityMinutes;
}
