import { z } from 'zod';
import { PaymentMethod, PaymentTransactionStatus } from '../enums.js';

export const paymentIdParamSchema = z.object({
  id: z.string().uuid('Invalid payment id'),
});

export const createPaymentOrderSchema = z.object({
  appointmentId: z.string().uuid('Select an appointment'),
});
export type CreatePaymentOrderInput = z.infer<typeof createPaymentOrderSchema>;

/** Never trust `status`/`amount` from the client — this input only carries the identifiers and
 * signature needed for server-side verification against the provider. */
export const verifyPaymentSchema = z.object({
  paymentId: z.string().uuid(),
  providerOrderId: z.string().min(1),
  providerPaymentId: z.string().min(1),
  providerSignature: z.string().min(1),
});
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;

export const refundPaymentSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  reason: z.string().trim().min(3, 'Provide a refund reason').max(300),
});
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;

/** Phase 24 — the realistic in-person collection methods only; NETBANKING/WALLET (online-only
 * concepts) are deliberately excluded from this staff-facing counter-collection form even though
 * the underlying PaymentMethod enum technically has them. `amount` is never accepted from the
 * client — the authoritative price is always recomputed server-side via calculatePrice, same as
 * online checkout, so staff can't accidentally under/over-record what's actually due. */
export const collectCounterPaymentSchema = z.object({
  appointmentId: z.string().uuid('Select an appointment'),
  method: z.enum(['CASH', 'CARD', 'UPI', 'OTHER']),
  notes: z.string().trim().max(300).optional().or(z.literal('')),
});
export type CollectCounterPaymentInput = z.infer<typeof collectCounterPaymentSchema>;

export const paymentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type PaymentListQuery = z.infer<typeof paymentListQuerySchema>;

export const clinicBillingQuerySchema = z
  .object({
    clinicId: z.string().uuid('Select a clinic'),
    doctorId: z.string().uuid().optional(),
    patientId: z.string().uuid().optional(),
    status: z.nativeEnum(PaymentTransactionStatus).optional(),
    method: z.nativeEnum(PaymentMethod).optional(),
    from: z.string().date('Enter a valid date').optional(),
    to: z.string().date('Enter a valid date').optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, { message: 'From date must be on or before to date', path: ['to'] });
export type ClinicBillingQuery = z.infer<typeof clinicBillingQuerySchema>;

export const webhookProviderParamSchema = z.object({
  provider: z.enum(['razorpay', 'stripe', 'mock']),
});
