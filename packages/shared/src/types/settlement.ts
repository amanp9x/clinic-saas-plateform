import type { SettlementStatus } from '../enums.js';

/** Phase 25 — Doctor Earnings Settlement Requests. `periodStart`/`periodEnd`/`amount` are always
 * computed server-side from the same earnings aggregation the read-only doctor dashboard already
 * uses — a doctor never supplies or edits them. */
export interface SettlementRequestDto {
  id: string;
  doctorId: string;
  doctorName: string;
  periodStart: string;
  periodEnd: string;
  amount: string;
  currency: string;
  status: SettlementStatus;
  doctorNotes: string | null;
  respondedAt: string | null;
  reviewNotes: string | null;
  paidAt: string | null;
  createdAt: string;
}
