import { z } from 'zod';
import { SettlementStatus } from '../enums.js';

export const requestSettlementSchema = z.object({
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});
export type RequestSettlementInput = z.infer<typeof requestSettlementSchema>;

export const doctorSettlementsQuerySchema = z.object({
  status: z.nativeEnum(SettlementStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type DoctorSettlementsQuery = z.infer<typeof doctorSettlementsQuerySchema>;

export const platformSettlementsQuerySchema = z.object({
  status: z.nativeEnum(SettlementStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type PlatformSettlementsQuery = z.infer<typeof platformSettlementsQuerySchema>;

/** Approve/mark-paid never require a note; reject does — same "reason required for a negative
 * outcome" convention as contact-message triage and prescription refill decline. */
export const approveSettlementSchema = z.object({
  reviewNotes: z.string().trim().max(500).optional().or(z.literal('')),
});
export type ApproveSettlementInput = z.infer<typeof approveSettlementSchema>;

export const rejectSettlementSchema = z.object({
  reviewNotes: z.string().trim().min(3, 'Enter a reason for rejecting this request').max(500),
});
export type RejectSettlementInput = z.infer<typeof rejectSettlementSchema>;

export const markSettlementPaidSchema = z.object({
  reviewNotes: z.string().trim().max(500).optional().or(z.literal('')),
});
export type MarkSettlementPaidInput = z.infer<typeof markSettlementPaidSchema>;
