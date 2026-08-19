import { randomBytes } from 'node:crypto';

/** Excludes visually-confusable characters (0/O, 1/I/L) — same alphabet and reasoning as
 * booking-reference.util.ts's `generateBookingReference`. ~33.5M combinations/day at length 5, so
 * a single generation is fine for a ticket-creation call site (not a scarce-resource race like
 * slot booking — a collision merely re-uses a suffix on the same calendar day, extremely unlikely
 * and inconsequential even if it happened, since ticketNumber is a display convenience, not the
 * row identity). */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function randomSuffix(length: number): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}

/** Human-friendly, publicly-safe ticket reference — e.g. "TCK-20260819-8F4K2". Not the row id;
 * safe to expose to patients/admins, internally searchable via SupportTicket.ticketNumber
 * (unique-indexed). */
export function generateTicketNumber(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `TCK-${y}${m}${d}-${randomSuffix(5)}`;
}
