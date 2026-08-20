import { z } from 'zod';

export const refillRequestCreateSchema = z.object({
  patientNote: z.string().trim().max(500).optional().or(z.literal('')),
});
export type RefillRequestCreateInput = z.infer<typeof refillRequestCreateSchema>;

export const refillRequestRespondSchema = z
  .object({
    status: z.enum(['APPROVED', 'DECLINED']),
    doctorNote: z.string().trim().max(1000).optional().or(z.literal('')),
  })
  .refine((data) => data.status !== 'DECLINED' || Boolean(data.doctorNote?.trim()), {
    message: 'Enter a reason for declining this request',
    path: ['doctorNote'],
  });
export type RefillRequestRespondInput = z.infer<typeof refillRequestRespondSchema>;

export const refillRequestListQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'DECLINED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type RefillRequestListQuery = z.infer<typeof refillRequestListQuerySchema>;
