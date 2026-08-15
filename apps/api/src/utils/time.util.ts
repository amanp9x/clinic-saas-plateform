/**
 * Canonical `@db.Time` round-trip convention used throughout this codebase: a wall-clock time
 * with no timezone round-trips through Prisma as a Date pinned to 1970-01-01 UTC, carrying only
 * the hour/minute. Every reader/writer of a `@db.Time` column should go through these three
 * functions rather than re-deriving the convention locally.
 */

export function parseTimeString(hhmm: string): Date {
  const [hour, minute] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(1970, 0, 1, hour, minute, 0));
}

export function timeMinutes(t: Date): number {
  return t.getUTCHours() * 60 + t.getUTCMinutes();
}

export function formatTime(t: Date): string {
  return t.toISOString().slice(11, 16);
}
