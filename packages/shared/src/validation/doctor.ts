import { z } from 'zod';
import { FoodTiming, LeaveType, Weekday } from '../enums.js';

/** Only the 5 manually-settable values — IN_CONSULTATION is system-set, NOT_ARRIVED/ARRIVED
 * are reserved for a future reception check-in flow. */
export const doctorManualStatusSchema = z.enum([
  'AVAILABLE',
  'DELAYED',
  'ON_BREAK',
  'UNAVAILABLE',
  'SESSION_ENDED',
]);
export type DoctorManualStatus = z.infer<typeof doctorManualStatusSchema>;

export const doctorStatusUpdateSchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
  status: doctorManualStatusSchema,
});
export type DoctorStatusUpdateInput = z.infer<typeof doctorStatusUpdateSchema>;

export const doctorProfileUpdateSchema = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  bio: z.string().trim().max(2000).optional().or(z.literal('')),
  qualifications: z.string().trim().max(300).optional().or(z.literal('')),
  languages: z.array(z.string().trim().min(1)).max(20).optional(),
  yearsExperience: z.coerce.number().int().min(0).max(70).optional(),
  consultationFee: z.coerce.number().min(0).max(1000000).optional(),
  onlineConsultation: z.boolean().optional(),
});
export type DoctorProfileUpdateInput = z.infer<typeof doctorProfileUpdateSchema>;

export const clinicAssociationUpdateSchema = z.object({
  consultationFeeOverride: z.coerce.number().min(0).max(1000000).nullable().optional(),
  consultationDurationMinutesOverride: z.coerce.number().int().min(5).max(180).nullable().optional(),
  isAcceptingAppointments: z.boolean().optional(),
  timings: z.string().trim().max(200).nullable().optional(),
  availableDays: z.array(z.nativeEnum(Weekday)).optional(),
});
export type ClinicAssociationUpdateInput = z.infer<typeof clinicAssociationUpdateSchema>;

const timeStringSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Use HH:MM 24-hour format');

export const scheduleSlotCreateSchema = z
  .object({
    clinicId: z.string().uuid('Select a clinic'),
    weekday: z.nativeEnum(Weekday),
    startTime: timeStringSchema,
    endTime: timeStringSchema,
    consultationDurationMinutes: z.coerce.number().int().min(5).max(180),
    breakStartTime: timeStringSchema.nullable().optional(),
    breakEndTime: timeStringSchema.nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .refine((d) => d.startTime < d.endTime, {
    message: 'Start time must be before end time',
    path: ['endTime'],
  });
export type ScheduleSlotCreateInput = z.infer<typeof scheduleSlotCreateSchema>;

export const scheduleSlotUpdateSchema = scheduleSlotCreateSchema;
export type ScheduleSlotUpdateInput = z.infer<typeof scheduleSlotUpdateSchema>;

export const leaveCreateSchema = z
  .object({
    clinicId: z.string().uuid().nullable().optional(),
    startDate: z.string().date('Enter a valid date'),
    endDate: z.string().date('Enter a valid date'),
    reason: z.string().trim().max(300).optional().or(z.literal('')),
    type: z.nativeEnum(LeaveType).default('LEAVE'),
  })
  .refine((d) => d.startDate <= d.endDate, {
    message: 'Start date must be on or before end date',
    path: ['endDate'],
  });
export type LeaveCreateInput = z.infer<typeof leaveCreateSchema>;

export const doctorAppointmentTabSchema = z.enum(['today', 'upcoming', 'past', 'cancelled', 'no-show']);
export type DoctorAppointmentTab = z.infer<typeof doctorAppointmentTabSchema>;

export const doctorAppointmentListQuerySchema = z.object({
  tab: doctorAppointmentTabSchema.default('today'),
  clinicId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type DoctorAppointmentListQuery = z.infer<typeof doctorAppointmentListQuerySchema>;

export const appointmentSkipSchema = z.object({
  reason: z.string().trim().max(300).optional().or(z.literal('')),
});
export type AppointmentSkipInput = z.infer<typeof appointmentSkipSchema>;

export const clinicIdQuerySchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
});
export type ClinicIdQuery = z.infer<typeof clinicIdQuerySchema>;

export const queueSessionActionSchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
});
export type QueueSessionActionInput = z.infer<typeof queueSessionActionSchema>;

export const queueSkipSchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
  tokenId: z.string().uuid('Select a token'),
  reason: z.string().trim().max(300).optional().or(z.literal('')),
});
export type QueueSkipInput = z.infer<typeof queueSkipSchema>;

export const queueRepeatCallSchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
  tokenId: z.string().uuid('Select a token'),
});
export type QueueRepeatCallInput = z.infer<typeof queueRepeatCallSchema>;

export const queueCallNextSchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
});
export type QueueCallNextInput = z.infer<typeof queueCallNextSchema>;

export const delayUpdateSchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
  delayMinutes: z.coerce.number().int().min(0).max(600).nullable(),
  delayReason: z.string().trim().max(300).nullable().optional(),
});
export type DelayUpdateInput = z.infer<typeof delayUpdateSchema>;

export const consultationVitalsSchema = z.object({
  heightCm: z.coerce.number().min(0).max(300).nullable().optional(),
  weightKg: z.coerce.number().min(0).max(500).nullable().optional(),
  temperatureC: z.coerce.number().min(20).max(45).nullable().optional(),
  bloodPressureSystolic: z.coerce.number().int().min(0).max(300).nullable().optional(),
  bloodPressureDiastolic: z.coerce.number().int().min(0).max(200).nullable().optional(),
  pulseRate: z.coerce.number().int().min(0).max(300).nullable().optional(),
  respiratoryRate: z.coerce.number().int().min(0).max(100).nullable().optional(),
  spo2: z.coerce.number().int().min(0).max(100).nullable().optional(),
});
export type ConsultationVitalsInput = z.infer<typeof consultationVitalsSchema>;

export const consultationUpsertSchema = z.object({
  chiefComplaint: z.string().trim().max(1000).optional().or(z.literal('')),
  symptoms: z.array(z.string().trim().min(1)).max(30).optional(),
  vitals: consultationVitalsSchema.optional(),
  diagnosis: z.string().trim().max(2000).optional().or(z.literal('')),
  doctorNotes: z.string().trim().max(4000).optional().or(z.literal('')),
  treatmentPlan: z.string().trim().max(2000).optional().or(z.literal('')),
  followUpDate: z.string().date('Enter a valid date').nullable().optional(),
});
export type ConsultationUpsertInput = z.infer<typeof consultationUpsertSchema>;

export const prescriptionItemSchema = z.object({
  medicineName: z.string().trim().min(1, 'Enter a medicine name').max(200),
  dosage: z.string().trim().min(1, 'Enter a dosage').max(100),
  frequency: z.string().trim().min(1, 'Enter a frequency').max(100),
  duration: z.string().trim().min(1, 'Enter a duration').max(100),
  route: z.string().trim().max(100).optional().or(z.literal('')),
  instructions: z.string().trim().max(500).optional().or(z.literal('')),
  beforeAfterFood: z.nativeEnum(FoodTiming).optional(),
  quantity: z.string().trim().max(50).optional().or(z.literal('')),
});
export type PrescriptionItemInput = z.infer<typeof prescriptionItemSchema>;

export const prescriptionCreateSchema = z.object({
  patientId: z.string().uuid('Select a patient'),
  appointmentId: z.string().uuid().optional(),
  diagnosis: z.string().trim().max(2000).optional().or(z.literal('')),
  advice: z.string().trim().max(2000).optional().or(z.literal('')),
  followUpDate: z.string().date('Enter a valid date').nullable().optional(),
  labTestRecommendation: z.array(z.string().trim().min(1)).max(20).optional(),
  items: z.array(prescriptionItemSchema).min(1, 'Add at least one medicine'),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
});
export type PrescriptionCreateInput = z.infer<typeof prescriptionCreateSchema>;

export const prescriptionUpdateSchema = prescriptionCreateSchema.omit({ patientId: true, appointmentId: true });
export type PrescriptionUpdateInput = z.infer<typeof prescriptionUpdateSchema>;

export const prescriptionListQuerySchema = z.object({
  patientId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'FINALIZED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type PrescriptionListQuery = z.infer<typeof prescriptionListQuerySchema>;

export const earningsQuerySchema = z.object({
  range: z.enum(['today', 'week', 'month']).default('today'),
});
export type EarningsQuery = z.infer<typeof earningsQuerySchema>;

export const reviewRespondSchema = z.object({
  response: z.string().trim().min(1, 'Enter a response').max(1000),
});
export type ReviewRespondInput = z.infer<typeof reviewRespondSchema>;

export const signatureUpsertSchema = z.object({
  signatureText: z.string().trim().max(120).optional().or(z.literal('')),
});
export type SignatureUpsertInput = z.infer<typeof signatureUpsertSchema>;

export const idParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});
export type IdParam = z.infer<typeof idParamSchema>;

export const appointmentIdParamSchema = z.object({
  appointmentId: z.string().uuid('Invalid appointment id'),
});
export type AppointmentIdParam = z.infer<typeof appointmentIdParamSchema>;

export const patientIdParamSchema = z.object({
  patientId: z.string().uuid('Invalid patient id'),
});
export type PatientIdParam = z.infer<typeof patientIdParamSchema>;

export const patientEntryIdParamSchema = z.object({
  patientId: z.string().uuid('Invalid patient id'),
  id: z.string().uuid('Invalid id'),
});
export type PatientEntryIdParam = z.infer<typeof patientEntryIdParamSchema>;

/// Phase 18 — Lab Reports & Vaccination entry workflow. A doctor orders a test (status defaults
/// PENDING, no result yet) then later updates it with the result via `labReportUpdateSchema`.
export const labReportCreateSchema = z.object({
  testName: z.string().trim().min(1, 'Enter a test name').max(200),
  labName: z.string().trim().max(200).optional().or(z.literal('')),
  appointmentId: z.string().uuid('Invalid appointment id').optional(),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
});
export type LabReportCreateInput = z.infer<typeof labReportCreateSchema>;

export const labReportUpdateSchema = z.object({
  status: z.enum(['PENDING', 'READY']).optional(),
  reportDate: z.string().date('Enter a valid date').optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
});
export type LabReportUpdateInput = z.infer<typeof labReportUpdateSchema>;

export const vaccinationCreateSchema = z.object({
  vaccineName: z.string().trim().min(1, 'Enter a vaccine name').max(200),
  doseNumber: z.coerce.number().int().min(1).max(20).optional(),
  administeredDate: z.string().date('Enter a valid date'),
  nextDueDate: z.string().date('Enter a valid date').optional().or(z.literal('')),
  administeredBy: z.string().trim().max(200).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
});
export type VaccinationCreateInput = z.infer<typeof vaccinationCreateSchema>;

export const clinicIdParamSchema = z.object({
  clinicId: z.string().uuid('Invalid clinic id'),
});
export type ClinicIdParam = z.infer<typeof clinicIdParamSchema>;
