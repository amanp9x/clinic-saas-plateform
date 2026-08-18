import { z } from 'zod';
import { WAITLIST_STATUSES } from '../types/waitlist.js';
import { bookingConsultationTypeSchema } from './booking.js';

export const joinWaitlistSchema = z.object({
  doctorId: z.string().uuid('Select a doctor'),
  clinicId: z.string().uuid('Select a clinic'),
  targetDate: z.string().date('Enter a valid date'),
  consultationType: bookingConsultationTypeSchema.optional(),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});
export type JoinWaitlistInput = z.infer<typeof joinWaitlistSchema>;

/** Reception adding a patient (existing or new) to the waitlist on their behalf — mirrors
 * `receptionCreateAppointmentSchema`'s existing-or-new-patient shape exactly. */
export const receptionJoinWaitlistSchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
  doctorId: z.string().uuid('Select a doctor'),
  targetDate: z.string().date('Enter a valid date'),
  consultationType: bookingConsultationTypeSchema.optional(),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
  patientId: z.string().uuid().optional(),
  newPatient: z
    .object({
      fullName: z.string().trim().min(1, 'Enter a name'),
      phone: z.string().trim().min(6, 'Enter a phone number'),
      age: z.coerce.number().int().min(0).max(120).optional(),
      gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED']).optional(),
    })
    .optional(),
});
export type ReceptionJoinWaitlistInput = z.infer<typeof receptionJoinWaitlistSchema>;

export const myWaitlistQuerySchema = z.object({
  status: z.enum(WAITLIST_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type MyWaitlistQuery = z.infer<typeof myWaitlistQuerySchema>;

export const clinicWaitlistQuerySchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
  doctorId: z.string().uuid().optional(),
  status: z.enum(WAITLIST_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type ClinicWaitlistQuery = z.infer<typeof clinicWaitlistQuerySchema>;

export const doctorWaitlistQuerySchema = z.object({
  clinicId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type DoctorWaitlistQuery = z.infer<typeof doctorWaitlistQuerySchema>;
