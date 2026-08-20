import { PaymentTransactionStatus } from '@prisma/client';
import { ConflictError } from '../../utils/app-error.js';

/**
 * Centralized, exhaustive transition graph for `Payment.status`. Nothing else in this module (or
 * anywhere else) is allowed to write `Payment.status` without going through `assertTransition`
 * first — arbitrary status writes are exactly what the Phase 9 spec forbids.
 *
 * Beyond the transitions the spec lists literally, three pragmatic additions are included and
 * documented here:
 *  - `FAILED -> PENDING`: a retry (payment.engine.ts `retryOrder`) creates a new PaymentAttempt
 *    and moves the parent Payment back to PENDING, rather than a new logical Payment.
 *  - `REFUND_PENDING -> CAPTURED` / `REFUND_PENDING -> PARTIALLY_REFUNDED` (rollback): if the
 *    provider's refund call itself fails, the payment must return to its pre-refund-attempt state
 *    rather than being stuck in REFUND_PENDING forever.
 *  - `CREATED -> CAPTURED`: Phase 24 offline/counter payments (cash collected at the front desk)
 *    have no gateway order/authorize round-trip to wait through — `collectCounterPayment` creates
 *    the Payment already-CREATED, then immediately hands it to the same `applyCapture` every online
 *    payment uses, which needs this one extra edge to legally reach CAPTURED in a single step.
 */
export const PAYMENT_STATE_MACHINE: Record<PaymentTransactionStatus, PaymentTransactionStatus[]> = {
  CREATED: ['PENDING', 'FAILED', 'CANCELLED', 'CAPTURED'],
  PENDING: ['AUTHORIZED', 'CAPTURED', 'FAILED', 'CANCELLED'],
  AUTHORIZED: ['CAPTURED', 'FAILED', 'CANCELLED'],
  FAILED: ['PENDING'],
  CANCELLED: [],
  CAPTURED: ['REFUND_PENDING'],
  REFUND_PENDING: ['REFUNDED', 'PARTIALLY_REFUNDED', 'CAPTURED'],
  REFUNDED: [],
  PARTIALLY_REFUNDED: ['REFUND_PENDING', 'REFUNDED'],
};

export function assertTransition(from: PaymentTransactionStatus, to: PaymentTransactionStatus): void {
  if (from === to) return; // idempotent no-op — callers rely on this for duplicate verify/webhook delivery
  const allowed = PAYMENT_STATE_MACHINE[from] ?? [];
  if (!allowed.includes(to)) {
    throw new ConflictError(`Invalid payment state transition: ${from} -> ${to}`);
  }
}

export function canTransition(from: PaymentTransactionStatus, to: PaymentTransactionStatus): boolean {
  return from === to || (PAYMENT_STATE_MACHINE[from] ?? []).includes(to);
}
