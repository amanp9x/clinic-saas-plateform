import { z } from 'zod';
import { ClinicVerificationStatus } from '../enums.js';

export const platformClinicListQuerySchema = z.object({
  verificationStatus: z.nativeEnum(ClinicVerificationStatus).optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type PlatformClinicListQuery = z.infer<typeof platformClinicListQuerySchema>;

/** Deliberately excludes PENDING/SUBMITTED — those are clinic-driven states an admin never sets
 * directly (SUBMITTED happens when the clinic itself submits for review). */
export const clinicVerificationUpdateSchema = z.object({
  status: z.enum(['UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED']),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
});
export type ClinicVerificationUpdateInput = z.infer<typeof clinicVerificationUpdateSchema>;

export const clinicDocumentStatusUpdateSchema = z.object({
  status: z.enum(['VERIFIED', 'REJECTED']),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});
export type ClinicDocumentStatusUpdateInput = z.infer<typeof clinicDocumentStatusUpdateSchema>;

export const platformClinicDocumentParamSchema = z.object({
  id: z.string().uuid('Invalid clinic id'),
  documentId: z.string().uuid('Invalid document id'),
});
