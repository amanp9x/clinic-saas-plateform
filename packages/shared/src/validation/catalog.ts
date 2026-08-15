import { z } from 'zod';
import { ConsultationType, Gender } from '../enums.js';

const page = z.coerce.number().int().min(1).default(1);
const limit = z.coerce.number().int().min(1).max(50).default(12);
const booleanish = z
  .union([z.boolean(), z.literal('true'), z.literal('false')])
  .transform((v) => v === true || v === 'true');

export const doctorSortSchema = z.enum([
  'relevance',
  'rating',
  'experience',
  'fee_low',
  'fee_high',
  'availability',
  'most_reviewed',
]);
export type DoctorSort = z.infer<typeof doctorSortSchema>;

export const doctorSearchSchema = z.object({
  query: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
  area: z.string().trim().max(80).optional(),
  clinicId: z.string().uuid().optional(),
  specializationSlug: z.string().trim().max(80).optional(),
  gender: z.nativeEnum(Gender).optional(),
  minExperience: z.coerce.number().int().min(0).max(60).optional(),
  maxFee: z.coerce.number().min(0).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  availableToday: booleanish.optional(),
  availableThisWeek: booleanish.optional(),
  onlineConsultation: booleanish.optional(),
  consultationType: z.nativeEnum(ConsultationType).optional(),
  languages: z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : [v]))
    .optional(),
  sort: doctorSortSchema.optional().default('relevance'),
  page,
  limit,
});
export type DoctorSearchInput = z.infer<typeof doctorSearchSchema>;

export const clinicSearchSchema = z.object({
  query: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
  area: z.string().trim().max(80).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  availableToday: booleanish.optional(),
  maxFee: z.coerce.number().min(0).optional(),
  consultationType: z.nativeEnum(ConsultationType).optional(),
  service: z.string().trim().max(120).optional(),
  page,
  limit,
});
export type ClinicSearchInput = z.infer<typeof clinicSearchSchema>;

export const hospitalSearchSchema = z.object({
  query: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
  page,
  limit,
});
export type HospitalSearchInput = z.infer<typeof hospitalSearchSchema>;

export const doctorSlugParamSchema = z.object({
  slug: z.string().trim().min(1),
});

export const clinicSlugParamSchema = z.object({
  slug: z.string().trim().min(1),
});

export const specializationSlugParamSchema = z.object({
  slug: z.string().trim().min(1),
});

export const doctorQueueQuerySchema = z.object({
  clinicId: z.string().uuid(),
});

export const previewLimitSchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(6),
});

export const contactMessageSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{6,14}$/, 'Enter a valid phone number')
    .or(z.literal(''))
    .optional()
    .transform((v) => (v ? v : undefined)),
  subject: z.string().trim().min(3, 'Enter a subject').max(150),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(2000),
});
export type ContactMessageInput = z.infer<typeof contactMessageSchema>;
