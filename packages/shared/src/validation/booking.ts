import { z } from 'zod';
import { AppointmentType, ConsultationType, Gender } from '../enums.js';

/** Booking input only accepts the two real modalities — FOLLOW_UP/EMERGENCY are legacy
 * ConsultationType values used by the catalog-search filter, not valid booking modalities. */
export const bookingConsultationTypeSchema = z.enum([ConsultationType.IN_CLINIC, ConsultationType.ONLINE]);

export const availabilityQuerySchema = z.object({
  doctorId: z.string().uuid(),
  clinicId: z.string().uuid(),
  date: z.string().date(),
  consultationType: bookingConsultationTypeSchema.optional(),
});
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

export const holdSlotSchema = z.object({
  doctorId: z.string().uuid(),
  clinicId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  consultationType: bookingConsultationTypeSchema,
});
export type HoldSlotInput = z.infer<typeof holdSlotSchema>;

export const holdParamSchema = z.object({
  id: z.string().uuid(),
});

export const createAppointmentSchema = z
  .object({
    holdId: z.string().uuid().optional(),
    doctorId: z.string().uuid().optional(),
    clinicId: z.string().uuid().optional(),
    scheduledAt: z.string().datetime().optional(),
    consultationType: bookingConsultationTypeSchema.optional(),
    appointmentType: z.nativeEnum(AppointmentType).default(AppointmentType.NEW_CONSULTATION),
    reasonForVisit: z.string().trim().max(500).optional(),
  })
  .refine(
    (v) => Boolean(v.holdId) || Boolean(v.doctorId && v.clinicId && v.scheduledAt && v.consultationType),
    { message: 'Provide either holdId, or doctorId+clinicId+scheduledAt+consultationType' },
  );
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const receptionCreateAppointmentSchema = z
  .object({
    patientId: z.string().uuid().optional(),
    newPatient: z
      .object({
        fullName: z.string().trim().min(2).max(120),
        phone: z.string().trim().optional(),
        age: z.coerce.number().int().min(0).max(150).optional(),
        gender: z.nativeEnum(Gender).optional(),
      })
      .optional(),
    holdId: z.string().uuid().optional(),
    doctorId: z.string().uuid().optional(),
    clinicId: z.string().uuid(),
    scheduledAt: z.string().datetime().optional(),
    consultationType: bookingConsultationTypeSchema.optional(),
    appointmentType: z.nativeEnum(AppointmentType).default(AppointmentType.NEW_CONSULTATION),
    reasonForVisit: z.string().trim().max(500).optional(),
  })
  .refine((v) => Boolean(v.patientId) || Boolean(v.newPatient), {
    message: 'Provide either patientId or newPatient',
  })
  .refine(
    (v) => Boolean(v.holdId) || Boolean(v.doctorId && v.scheduledAt && v.consultationType),
    { message: 'Provide either holdId, or doctorId+scheduledAt+consultationType' },
  );
export type ReceptionCreateAppointmentInput = z.infer<typeof receptionCreateAppointmentSchema>;

export const rescheduleAppointmentSchema = z.object({
  newScheduledAt: z.string().datetime(),
  holdId: z.string().uuid().optional(),
  reason: z.string().trim().max(300).optional(),
});
export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;

export const receptionCancelAppointmentSchema = z.object({
  reason: z.string().trim().min(3, 'Provide a cancellation reason').max(300),
});
export type ReceptionCancelAppointmentInput = z.infer<typeof receptionCancelAppointmentSchema>;

export const receptionNoShowSchema = z.object({
  clinicId: z.string().uuid(),
  reason: z.string().trim().max(300).optional(),
});
export type ReceptionNoShowInput = z.infer<typeof receptionNoShowSchema>;

export const blockedSlotCreateSchema = z
  .object({
    doctorId: z.string().uuid().optional(),
    clinicId: z.string().uuid(),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    reason: z.string().trim().min(3).max(300),
  })
  .refine((v) => new Date(v.endAt) > new Date(v.startAt), { message: 'endAt must be after startAt', path: ['endAt'] });
export type BlockedSlotCreateInput = z.infer<typeof blockedSlotCreateSchema>;

export const blockedSlotParamSchema = z.object({
  id: z.string().uuid(),
});
