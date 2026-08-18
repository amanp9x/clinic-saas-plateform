import { z } from 'zod';

export const doctorFollowUpsQuerySchema = z.object({
  clinicId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type DoctorFollowUpsQuery = z.infer<typeof doctorFollowUpsQuerySchema>;

export const clinicFollowUpsQuerySchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
  doctorId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type ClinicFollowUpsQuery = z.infer<typeof clinicFollowUpsQuerySchema>;
