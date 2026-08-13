import { z } from 'zod';
import { Gender, TokenPriority } from '../enums.js';
import { phoneSchema } from './auth.js';

export const checkInSchema = z.object({
  appointmentId: z.string().uuid('Select an appointment'),
});
export type CheckInInput = z.infer<typeof checkInSchema>;

export const walkInPaymentStatusSchema = z.enum(['PENDING', 'PAID', 'WAIVED']);
export type WalkInPaymentStatus = z.infer<typeof walkInPaymentStatusSchema>;

export const walkInCreateSchema = z
  .object({
    clinicId: z.string().uuid('Select a clinic'),
    doctorId: z.string().uuid('Select a doctor'),
    existingPatientId: z.string().uuid().optional(),
    fullName: z.string().trim().min(2, 'Enter the patient name').max(120).optional(),
    phone: phoneSchema.optional(),
    age: z.coerce.number().int().min(0).max(120).optional(),
    gender: z.nativeEnum(Gender).optional(),
    reasonForVisit: z.string().trim().max(300).optional().or(z.literal('')),
    paymentStatus: walkInPaymentStatusSchema.default('PENDING'),
    priority: z.nativeEnum(TokenPriority).default('NORMAL'),
  })
  .refine((d) => Boolean(d.existingPatientId) || Boolean(d.fullName && d.phone), {
    message: 'Provide either an existing patient or a name and phone number',
    path: ['fullName'],
  });
export type WalkInCreateInput = z.infer<typeof walkInCreateSchema>;

export const receptionQueueActionSchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
  doctorId: z.string().uuid('Select a doctor'),
});
export type ReceptionQueueActionInput = z.infer<typeof receptionQueueActionSchema>;

export const receptionQueueTokenActionSchema = receptionQueueActionSchema.extend({
  tokenId: z.string().uuid('Select a token'),
});
export type ReceptionQueueTokenActionInput = z.infer<typeof receptionQueueTokenActionSchema>;

export const receptionSkipSchema = receptionQueueTokenActionSchema.extend({
  reason: z.string().trim().max(300).optional().or(z.literal('')),
});
export type ReceptionSkipInput = z.infer<typeof receptionSkipSchema>;

export const receptionDelayUpdateSchema = receptionQueueActionSchema
  .extend({
    delayMinutes: z.coerce.number().int().min(0).max(600).nullable(),
    delayReason: z.string().trim().max(300).nullable().optional(),
  })
  .refine((d) => d.delayMinutes === null || Boolean(d.delayReason && d.delayReason.trim()), {
    message: 'A reason is required whenever a delay is set',
    path: ['delayReason'],
  });
export type ReceptionDelayUpdateInput = z.infer<typeof receptionDelayUpdateSchema>;

export const DELAY_REASON_PRESETS = [
  'Doctor running late',
  'Emergency patient',
  'Extended consultation',
  'Staff issue',
  'Technical issue',
  'Doctor break',
  'Other',
] as const;

export const receptionPauseSchema = receptionQueueActionSchema.extend({
  reason: z.string().trim().max(300).optional().or(z.literal('')),
});
export type ReceptionPauseInput = z.infer<typeof receptionPauseSchema>;

export const receptionPriorityUpdateSchema = receptionQueueTokenActionSchema.extend({
  priority: z.nativeEnum(TokenPriority),
});
export type ReceptionPriorityUpdateInput = z.infer<typeof receptionPriorityUpdateSchema>;

export const receptionAppointmentActionSchema = receptionQueueActionSchema.extend({
  appointmentId: z.string().uuid('Select an appointment'),
});
export type ReceptionAppointmentActionInput = z.infer<typeof receptionAppointmentActionSchema>;

export const receptionAppointmentTabSchema = z.enum(['today', 'upcoming', 'all']);
export type ReceptionAppointmentTab = z.infer<typeof receptionAppointmentTabSchema>;

export const receptionAppointmentListQuerySchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
  doctorId: z.string().uuid().optional(),
  tab: receptionAppointmentTabSchema.default('today'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ReceptionAppointmentListQuery = z.infer<typeof receptionAppointmentListQuerySchema>;

export const patientSearchQuerySchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
  q: z.string().trim().min(1, 'Enter a search term').max(100),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type PatientSearchQuery = z.infer<typeof patientSearchQuerySchema>;

export const reportsQuerySchema = z
  .object({
    clinicId: z.string().uuid('Select a clinic'),
    from: z.string().date('Enter a valid date'),
    to: z.string().date('Enter a valid date'),
  })
  .refine((d) => d.from <= d.to, { message: 'From date must be on or before to date', path: ['to'] });
export type ReportsQuery = z.infer<typeof reportsQuerySchema>;

export const receptionDoctorStatusUpdateSchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
  status: z.enum(['AVAILABLE', 'DELAYED', 'ON_BREAK', 'UNAVAILABLE', 'SESSION_ENDED']),
});
export type ReceptionDoctorStatusUpdateInput = z.infer<typeof receptionDoctorStatusUpdateSchema>;

export const queueHistoryQuerySchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
  date: z.string().date('Enter a valid date').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type QueueHistoryQuery = z.infer<typeof queueHistoryQuerySchema>;

export const doctorIdParamSchema = z.object({
  doctorId: z.string().uuid('Invalid doctor id'),
});
export type DoctorIdParam = z.infer<typeof doctorIdParamSchema>;
