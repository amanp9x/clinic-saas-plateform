import type { DocumentExpiryStatus } from '@clinic/shared';

/** Phase 17 — Compliance & Renewal. Never persisted: `ClinicDocument.expiryDate` is the only
 * stored fact, and this status is derived fresh on every read — same convention as `SlotStatus`
 * and the waitlist's display-only states elsewhere in this codebase. */
export const EXPIRING_SOON_WINDOW_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function computeDocumentExpiryStatus(expiryDate: Date | null, now: Date = new Date()): DocumentExpiryStatus {
  if (!expiryDate) return 'NOT_TRACKED';
  const daysUntil = (expiryDate.getTime() - now.getTime()) / MS_PER_DAY;
  if (daysUntil < 0) return 'EXPIRED';
  if (daysUntil <= EXPIRING_SOON_WINDOW_DAYS) return 'EXPIRING_SOON';
  return 'VALID';
}
