import { randomBytes } from 'node:crypto';

/** Excludes visually-confusable characters (0/O, 1/I/L) — this reference is read aloud at
 * reception desks and typed back in by patients, so legibility matters more than raw entropy. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function randomSuffix(length: number): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}

/** Human-friendly, publicly-safe booking reference — e.g. "APT-20260815-8F4K2". Not the row id;
 * safe to expose to patients/reception, internally searchable via Appointment.bookingReference
 * (unique-indexed). ~33.5M combinations/day at length 5, so a single generation is fine for
 * non-concurrency-critical call sites (walk-in registration, test fixtures); the core booking
 * engine's create path additionally retries on the rare unique-constraint collision. */
export function generateBookingReference(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `APT-${y}${m}${d}-${randomSuffix(5)}`;
}
