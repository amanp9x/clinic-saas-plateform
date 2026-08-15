import type { Weekday } from '@prisma/client';
import { weekdayForDate } from './weekday.js';

export interface AvailabilityTemplateRow {
  weekday: Weekday;
  startTime: Date;
  endTime: Date;
}

export interface LeaveRange {
  startDate: Date;
  endDate: Date;
  clinicId: string | null;
}

export interface HolidayDate {
  date: Date;
  isFullDay: boolean;
}

export interface NextAvailableResult {
  date: string;
  weekday: Weekday;
  startTime: string;
  endTime: string;
}

function toUtcDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** @db.Time fields round-trip through Prisma as a 1970-01-01 UTC date carrying only the
 * wall-clock time — this reads that time back out as minutes-since-midnight. `from` is compared
 * on the same basis (its UTC hour/minute), so the two sides stay internally consistent regardless
 * of server deployment timezone — no clinic-timezone-aware conversion exists in this codebase. */
function timeMinutes(t: Date): number {
  return t.getUTCHours() * 60 + t.getUTCMinutes();
}

function formatTime(t: Date): string {
  return t.toISOString().slice(11, 16);
}

/**
 * Next day (and session time window) a doctor has a scheduled session at a clinic, derived
 * purely from the weekly `DoctorAvailability` template plus `DoctorLeave`/`ClinicHoliday`
 * exclusions. This is a day-level estimate only — it does not reserve or track individual
 * timeslots against booked `Appointment` rows (no slot-booking engine exists in this codebase).
 * Partial-day holidays are ignored (treated as not blocking) — a deliberate simplification
 * consistent with the day-level-only scope.
 */
export function computeNextAvailableSession(
  templates: AvailabilityTemplateRow[],
  leaves: LeaveRange[],
  holidays: HolidayDate[],
  clinicId: string,
  from: Date = new Date(),
  horizonDays = 30,
): NextAvailableResult | null {
  if (templates.length === 0) return null;

  const nowMinutes = timeMinutes(from);
  const startOfToday = toUtcDateOnly(from);

  for (let offset = 0; offset <= horizonDays; offset++) {
    const day = addDays(startOfToday, offset);
    const weekday = weekdayForDate(day);

    const isFullDayHoliday = holidays.some(
      (h) => h.isFullDay && toUtcDateOnly(h.date).getTime() === day.getTime(),
    );
    if (isFullDayHoliday) continue;

    const isOnLeave = leaves.some(
      (l) =>
        (l.clinicId === null || l.clinicId === clinicId) &&
        day.getTime() >= toUtcDateOnly(l.startDate).getTime() &&
        day.getTime() <= toUtcDateOnly(l.endDate).getTime(),
    );
    if (isOnLeave) continue;

    const daySessions = templates
      .filter((t) => t.weekday === weekday)
      .sort((a, b) => timeMinutes(a.startTime) - timeMinutes(b.startTime));
    if (daySessions.length === 0) continue;

    const candidate =
      offset === 0
        ? daySessions.find((s) => timeMinutes(s.endTime) > nowMinutes)
        : daySessions[0];
    if (!candidate) continue;

    return {
      date: isoDateOnly(day),
      weekday,
      startTime: formatTime(candidate.startTime),
      endTime: formatTime(candidate.endTime),
    };
  }

  return null;
}
