import { describe, expect, it } from 'vitest';
import { computeNextAvailableSession } from '../../src/utils/availability.util.js';

const CLINIC_ID = 'clinic-1';

function utcTime(hh: number, mm: number): Date {
  return new Date(Date.UTC(1970, 0, 1, hh, mm, 0));
}

function utcDate(y: number, m: number, d: number, hh = 0, mm = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
}

describe('computeNextAvailableSession', () => {
  it('returns null when there is no weekly template', () => {
    const result = computeNextAvailableSession([], [], [], CLINIC_ID, utcDate(2026, 8, 17, 9, 0));
    expect(result).toBeNull();
  });

  it('finds a simple next-day match', () => {
    // 2026-08-17 is a Monday. Template only on Tuesday.
    const from = utcDate(2026, 8, 17, 9, 0);
    const result = computeNextAvailableSession(
      [{ weekday: 'TUE', startTime: utcTime(10, 0), endTime: utcTime(13, 0) }],
      [],
      [],
      CLINIC_ID,
      from,
    );
    expect(result).toEqual({ date: '2026-08-18', weekday: 'TUE', startTime: '10:00', endTime: '13:00' });
  });

  it('skips days covered by a doctor leave, even past the end of the leave range', () => {
    // Template on both Mon and Tue; doctor is on leave through both 8/17 (Mon) and 8/18 (Tue).
    // No other weekday has a template, so the next match is the following Monday (8/24).
    const from = utcDate(2026, 8, 17, 9, 0); // Monday
    const result = computeNextAvailableSession(
      [
        { weekday: 'MON', startTime: utcTime(10, 0), endTime: utcTime(13, 0) },
        { weekday: 'TUE', startTime: utcTime(10, 0), endTime: utcTime(13, 0) },
      ],
      [{ startDate: utcDate(2026, 8, 17), endDate: utcDate(2026, 8, 18), clinicId: null }],
      [],
      CLINIC_ID,
      from,
    );
    expect(result?.date).toBe('2026-08-24');
  });

  it('skips a full-day clinic holiday', () => {
    const from = utcDate(2026, 8, 17, 9, 0); // Monday
    const result = computeNextAvailableSession(
      [{ weekday: 'MON', startTime: utcTime(10, 0), endTime: utcTime(13, 0) }],
      [],
      [{ date: utcDate(2026, 8, 17), isFullDay: true }],
      CLINIC_ID,
      from,
    );
    // Next Monday, one week later.
    expect(result?.date).toBe('2026-08-24');
  });

  it('rolls to the next matching weekday when today\'s sessions already ended', () => {
    const from = utcDate(2026, 8, 17, 14, 0); // Monday, 2pm — after the 10-13 session
    const result = computeNextAvailableSession(
      [{ weekday: 'MON', startTime: utcTime(10, 0), endTime: utcTime(13, 0) }],
      [],
      [],
      CLINIC_ID,
      from,
    );
    expect(result?.date).toBe('2026-08-24');
  });

  it('still returns today when now is within the session window', () => {
    const from = utcDate(2026, 8, 17, 11, 0); // Monday, 11am — within 10-13
    const result = computeNextAvailableSession(
      [{ weekday: 'MON', startTime: utcTime(10, 0), endTime: utcTime(13, 0) }],
      [],
      [],
      CLINIC_ID,
      from,
    );
    expect(result?.date).toBe('2026-08-17');
  });

  it('respects the horizon and returns null if nothing matches within it', () => {
    const from = utcDate(2026, 8, 17, 9, 0);
    const result = computeNextAvailableSession(
      [{ weekday: 'MON', startTime: utcTime(10, 0), endTime: utcTime(13, 0) }],
      [{ startDate: utcDate(2026, 8, 17), endDate: utcDate(2026, 9, 17), clinicId: null }],
      [],
      CLINIC_ID,
      from,
      10,
    );
    expect(result).toBeNull();
  });

  it('picks the earliest of multiple same-day sessions', () => {
    const from = utcDate(2026, 8, 18, 6, 0); // Tuesday morning
    const result = computeNextAvailableSession(
      [
        { weekday: 'TUE', startTime: utcTime(15, 0), endTime: utcTime(18, 0) },
        { weekday: 'TUE', startTime: utcTime(9, 0), endTime: utcTime(12, 0) },
      ],
      [],
      [],
      CLINIC_ID,
      from,
    );
    expect(result).toEqual({ date: '2026-08-18', weekday: 'TUE', startTime: '09:00', endTime: '12:00' });
  });

  it('ignores a leave scoped to a different clinic', () => {
    const from = utcDate(2026, 8, 17, 9, 0); // Monday
    const result = computeNextAvailableSession(
      [{ weekday: 'MON', startTime: utcTime(10, 0), endTime: utcTime(13, 0) }],
      [{ startDate: utcDate(2026, 8, 17), endDate: utcDate(2026, 8, 17), clinicId: 'other-clinic' }],
      [],
      CLINIC_ID,
      from,
    );
    expect(result?.date).toBe('2026-08-17');
  });
});
