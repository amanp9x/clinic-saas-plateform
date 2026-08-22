import { z } from 'zod';
import { RefundRequestStatus } from '../enums.js';

/** Mirrors `refundPaymentSchema`'s own shape exactly — `amount` omitted means "the full eligible
 * amount," never accepted as a blank check above what the payment engine independently computes. */
export const createRefundRequestSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  reason: z.string().trim().min(3, 'Provide a refund reason').max(300),
});
export type CreateRefundRequestInput = z.infer<typeof createRefundRequestSchema>;

export const clinicRefundRequestsQuerySchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
  status: z.nativeEnum(RefundRequestStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type ClinicRefundRequestsQuery = z.infer<typeof clinicRefundRequestsQuerySchema>;

/** Approve never requires a note; reject does — same "reason required for a negative outcome"
 * convention as settlement requests, contact-message triage, and refill decline. */
export const approveRefundRequestSchema = z.object({
  reviewNotes: z.string().trim().max(500).optional().or(z.literal('')),
});
export type ApproveRefundRequestInput = z.infer<typeof approveRefundRequestSchema>;

export const rejectRefundRequestSchema = z.object({
  reviewNotes: z.string().trim().min(3, 'Enter a reason for rejecting this request').max(500),
});
export type RejectRefundRequestInput = z.infer<typeof rejectRefundRequestSchema>;
