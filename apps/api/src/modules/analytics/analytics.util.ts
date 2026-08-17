import type { AnalyticsDateRangeQuery } from '@clinic/shared';
import type { DateRangePreset, ResolvedDateRangeDto } from '@clinic/shared';
import { ValidationError } from '../../utils/app-error.js';
import { startOfDay, startOfMonth } from '../../utils/date.js';

export interface ResolvedRange {
  preset: DateRangePreset;
  /** Inclusive. */
  start: Date;
  /** Exclusive — every analytics query filters `>= start AND < end`, matching the spec's
   * `[start, end)` convention so adjacent periods (e.g. "today" and "yesterday") never double-count
   * a record that lands exactly on the boundary millisecond. */
  end: Date;
}

const MAX_CUSTOM_RANGE_DAYS = 366;

/** Every timestamp in this codebase (Appointment.scheduledAt, DoctorSession.sessionDate, etc.) is
 * stored and interpreted as server-local time standing in for clinic-local time — an explicit,
 * documented decision made in Phase 8 (see the Phase 8 plan's "Timezone" limitation) because this
 * deployment targets a single-timezone market and no IANA timezone library is used anywhere in the
 * codebase. Introducing real per-clinic timezone conversion here would make analytics boundaries
 * disagree with how every other module already reads/writes the same columns — not more correct,
 * just inconsistently correct. `Clinic.timezone` is read below only to echo it back in the response
 * for transparency (per spec section 32's "document timezone behavior"), never to shift the
 * boundary math itself.
 */
export function resolveDateRange(query: Pick<AnalyticsDateRangeQuery, 'range' | 'from' | 'to'>, now: Date = new Date()): ResolvedRange {
  const today = startOfDay(now);
  const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000);

  switch (query.range) {
    case 'today':
      return { preset: 'today', start: today, end: addDays(today, 1) };
    case 'yesterday':
      return { preset: 'yesterday', start: addDays(today, -1), end: today };
    case 'last7days':
      return { preset: 'last7days', start: addDays(today, -6), end: addDays(today, 1) };
    case 'last30days':
      return { preset: 'last30days', start: addDays(today, -29), end: addDays(today, 1) };
    case 'thisMonth': {
      const start = startOfMonth(today);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      return { preset: 'thisMonth', start, end };
    }
    case 'previousMonth': {
      const thisMonthStart = startOfMonth(today);
      const start = new Date(thisMonthStart.getFullYear(), thisMonthStart.getMonth() - 1, 1);
      return { preset: 'previousMonth', start, end: thisMonthStart };
    }
    case 'custom': {
      if (!query.from || !query.to) {
        throw new ValidationError('Custom date range requires both "from" and "to"');
      }
      const start = startOfDay(new Date(`${query.from}T00:00:00`));
      const end = addDays(startOfDay(new Date(`${query.to}T00:00:00`)), 1);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new ValidationError('Invalid custom date range');
      }
      if (start >= end) {
        throw new ValidationError('"from" must be on or before "to"');
      }
      const spanDays = (end.getTime() - start.getTime()) / 86_400_000;
      if (spanDays > MAX_CUSTOM_RANGE_DAYS) {
        throw new ValidationError(`Custom date range cannot exceed ${MAX_CUSTOM_RANGE_DAYS} days`);
      }
      return { preset: 'custom', start, end };
    }
    default:
      throw new ValidationError('Unsupported date range');
  }
}

export function toResolvedDateRangeDto(range: ResolvedRange): ResolvedDateRangeDto {
  return { preset: range.preset, start: range.start.toISOString(), end: range.end.toISOString() };
}

export function safeDivide(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return numerator / denominator;
}

export function roundOrNull(value: number | null, decimals = 2): number | null {
  if (value === null || Number.isNaN(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Minimal RFC 4180 CSV field escaping — no external dependency, matching this codebase's
 * convention of writing small focused utilities rather than adding a library for a single use. */
export function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(','));
  }
  return lines.join('\r\n');
}
