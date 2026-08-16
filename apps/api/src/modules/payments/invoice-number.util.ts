import { prisma } from '../../config/database.js';

/**
 * Concurrency-safe `INV-<year>-<seq>` generator. The single-statement `INSERT ... ON CONFLICT DO
 * UPDATE ... RETURNING` is atomic in Postgres by itself — no application-level locking or retry
 * loop needed, and two concurrent callers can never receive the same sequence number (this is
 * what the "duplicate invoice numbers under concurrency" test exercises).
 */
export async function nextInvoiceNumber(now: Date = new Date()): Promise<string> {
  const year = now.getFullYear();
  const rows = await prisma.$queryRaw<{ lastNumber: number }[]>`
    INSERT INTO invoice_sequences (year, "lastNumber")
    VALUES (${year}, 1)
    ON CONFLICT (year) DO UPDATE SET "lastNumber" = invoice_sequences."lastNumber" + 1
    RETURNING "lastNumber"
  `;
  const seq = rows[0]!.lastNumber;
  return `INV-${year}-${String(seq).padStart(6, '0')}`;
}
