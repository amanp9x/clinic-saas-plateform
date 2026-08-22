import type { RefundRequestStatus } from '../enums.js';

/** Phase 28 — Patient-Initiated Refund Requests. `amount` mirrors `RefundPaymentInput.amount`'s
 * own convention exactly: null means "the full eligible amount," never a client-editable total.
 * Full shape — used by the clinic-staff review queue, which needs patient/clinic/booking context
 * since it lists requests across many payments at once. */
export interface RefundRequestDto {
  id: string;
  paymentId: string;
  patientId: string;
  patientName: string;
  clinicId: string;
  clinicName: string;
  bookingReference: string;
  amount: string | null;
  reason: string;
  status: RefundRequestStatus;
  respondedByUserId: string | null;
  respondedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
}

/** Lighter shape embedded directly in `PaymentDto.refundRequests` — the surrounding payment
 * already carries patient/clinic/booking context, so this omits what would otherwise be
 * redundant. Mirrors `RefundDto`'s own minimal shape for the same reason. */
export interface RefundRequestSummaryDto {
  id: string;
  amount: string | null;
  reason: string;
  status: RefundRequestStatus;
  reviewNotes: string | null;
  respondedAt: string | null;
  createdAt: string;
}
