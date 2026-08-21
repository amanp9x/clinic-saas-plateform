import { z } from 'zod';
import {
  ClinicDocumentType,
  ClinicDoctorStatus,
  ClinicOperatingStatus,
  ClinicResourceStatus,
  ClinicResourceType,
  ConsultationType,
  PatientDataVisibility,
  UserRole,
  Weekday,
} from '../enums.js';
import { phoneSchema } from './auth.js';

const timeStringSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24-hour)');

export const clinicProfileUpdateSchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
  name: z.string().trim().min(2).max(150).optional(),
  legalName: z.string().trim().max(150).nullable().optional(),
  clinicType: z.string().trim().max(80).nullable().optional(),
  registrationNumber: z.string().trim().max(80).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  phone: phoneSchema.nullable().optional(),
  alternatePhone: phoneSchema.nullable().optional(),
  website: z.string().trim().url().max(300).nullable().optional(),
  addressLine1: z.string().trim().max(200).nullable().optional(),
  addressLine2: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  state: z.string().trim().max(100).nullable().optional(),
  country: z.string().trim().max(2).optional(),
  postalCode: z.string().trim().max(20).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  establishedYear: z.coerce.number().int().min(1800).max(new Date().getFullYear()).nullable().optional(),
  languages: z.array(z.string().trim().max(40)).max(20).optional(),
  facilities: z.array(z.string().trim().max(60)).max(30).optional(),
  accessibilityInfo: z.string().trim().max(1000).nullable().optional(),
  instagramUrl: z.string().trim().url().max(300).nullable().optional(),
  facebookUrl: z.string().trim().url().max(300).nullable().optional(),
  timezone: z.string().trim().max(60).optional(),
});
export type ClinicProfileUpdateInput = z.infer<typeof clinicProfileUpdateSchema>;

export const clinicVerificationSubmitSchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
  notes: z.string().trim().max(2000).optional(),
});
export type ClinicVerificationSubmitInput = z.infer<typeof clinicVerificationSubmitSchema>;

export const clinicStatusUpdateSchema = z
  .object({
    clinicId: z.string().uuid('Select a clinic'),
    status: z.nativeEnum(ClinicOperatingStatus),
    reason: z.string().trim().max(300).optional(),
  })
  .refine((d) => d.status !== 'TEMPORARILY_CLOSED' || Boolean(d.reason && d.reason.trim()), {
    message: 'A reason is required to temporarily close the clinic',
    path: ['reason'],
  });
export type ClinicStatusUpdateInput = z.infer<typeof clinicStatusUpdateSchema>;

export const documentUploadSchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
  type: z.nativeEnum(ClinicDocumentType),
  expiryDate: z.string().date('Enter a valid date').optional().or(z.literal('')),
});
export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;

/** Phase 17 — Compliance & Renewal. `expiryDate: null` explicitly clears a previously-set date
 * (distinct from omitting the field, which zod would treat as "no change" if this were partial —
 * this endpoint always sets the field to exactly what's sent). */
export const documentExpiryUpdateSchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
  expiryDate: z.string().date('Enter a valid date').nullable(),
});
export type DocumentExpiryUpdateInput = z.infer<typeof documentExpiryUpdateSchema>;

export const doctorSearchQuerySchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
  q: z.string().trim().min(1).max(100),
});
export type DoctorSearchQuery = z.infer<typeof doctorSearchQuerySchema>;

export const clinicDoctorAssociateSchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
  doctorId: z.string().uuid('Select a doctor'),
  departmentId: z.string().uuid().nullable().optional(),
  consultationFeeOverride: z.coerce.number().nonnegative().nullable().optional(),
  consultationDurationMinutesOverride: z.coerce.number().int().min(5).max(180).nullable().optional(),
  consultationTypes: z.array(z.nativeEnum(ConsultationType)).min(1).default(['IN_CLINIC']),
  timings: z.string().trim().max(200).nullable().optional(),
  availableDays: z.array(z.nativeEnum(Weekday)).optional(),
  startDate: z.string().date().nullable().optional(),
});
export type ClinicDoctorAssociateInput = z.infer<typeof clinicDoctorAssociateSchema>;

export const clinicDoctorUpdateSchema = z.object({
  departmentId: z.string().uuid().nullable().optional(),
  consultationFeeOverride: z.coerce.number().nonnegative().nullable().optional(),
  consultationDurationMinutesOverride: z.coerce.number().int().min(5).max(180).nullable().optional(),
  consultationTypes: z.array(z.nativeEnum(ConsultationType)).min(1).optional(),
  timings: z.string().trim().max(200).nullable().optional(),
  availableDays: z.array(z.nativeEnum(Weekday)).optional(),
  isAcceptingAppointments: z.boolean().optional(),
  queueEnabled: z.boolean().optional(),
  canOverrideDelay: z.boolean().optional(),
  startDate: z.string().date().nullable().optional(),
  endDate: z.string().date().nullable().optional(),
});
export type ClinicDoctorUpdateInput = z.infer<typeof clinicDoctorUpdateSchema>;

export const clinicDoctorStatusUpdateSchema = z.object({
  status: z.nativeEnum(ClinicDoctorStatus),
  /** Only meaningful when moving away from ACTIVE — becomes the cancellation reason on any
   * already-booked appointment this cascades into cancelling. Ignored when reactivating. */
  reason: z.string().trim().max(300).optional(),
});
export type ClinicDoctorStatusUpdateInput = z.infer<typeof clinicDoctorStatusUpdateSchema>;

export const departmentCreateSchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  displayOrder: z.coerce.number().int().min(0).default(0),
});
export type DepartmentCreateInput = z.infer<typeof departmentCreateSchema>;

export const departmentUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});
export type DepartmentUpdateInput = z.infer<typeof departmentUpdateSchema>;

export const serviceCreateSchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  price: z.coerce.number().nonnegative(),
  taxApplicable: z.boolean().default(false),
});
export type ServiceCreateInput = z.infer<typeof serviceCreateSchema>;

export const serviceUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  durationMinutes: z.coerce.number().int().min(5).max(480).optional(),
  price: z.coerce.number().nonnegative().optional(),
  taxApplicable: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export type ServiceUpdateInput = z.infer<typeof serviceUpdateSchema>;

const workingHoursSessionSchema = z
  .object({
    startTime: timeStringSchema,
    endTime: timeStringSchema,
  })
  .refine((s) => s.startTime < s.endTime, { message: 'Opening time must be before closing time', path: ['endTime'] });

export const workingHoursUpdateSchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
  weekday: z.nativeEnum(Weekday),
  isOpen: z.boolean(),
  sessions: z.array(workingHoursSessionSchema).max(4).default([]),
}).refine(
  (d) => {
    if (!d.isOpen) return true;
    const sorted = [...d.sessions].sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i]!.startTime < sorted[i - 1]!.endTime) return false;
    }
    return true;
  },
  { message: 'Sessions cannot overlap', path: ['sessions'] },
);
export type WorkingHoursUpdateInput = z.infer<typeof workingHoursUpdateSchema>;

export const holidayCreateSchema = z
  .object({
    clinicId: z.string().uuid('Select a clinic'),
    date: z.string().date('Enter a valid date'),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional(),
    isFullDay: z.boolean().default(true),
    startTime: timeStringSchema.optional(),
    endTime: timeStringSchema.optional(),
  })
  .refine((d) => d.isFullDay || (d.startTime && d.endTime && d.startTime < d.endTime), {
    message: 'Partial-day holidays require a valid start and end time',
    path: ['endTime'],
  });
export type HolidayCreateInput = z.infer<typeof holidayCreateSchema>;

export const resourceCreateSchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
  name: z.string().trim().min(1).max(100),
  type: z.nativeEnum(ClinicResourceType),
  code: z.string().trim().max(30).optional(),
  floor: z.string().trim().max(30).optional(),
  capacity: z.coerce.number().int().min(1).max(500).optional(),
});
export type ResourceCreateInput = z.infer<typeof resourceCreateSchema>;

export const resourceUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  type: z.nativeEnum(ClinicResourceType).optional(),
  code: z.string().trim().max(30).nullable().optional(),
  floor: z.string().trim().max(30).nullable().optional(),
  capacity: z.coerce.number().int().min(1).max(500).nullable().optional(),
  status: z.nativeEnum(ClinicResourceStatus).optional(),
});
export type ResourceUpdateInput = z.infer<typeof resourceUpdateSchema>;

const staffRoleSchema = z.enum([UserRole.RECEPTIONIST, UserRole.CLINIC_STAFF, UserRole.CLINIC_ADMIN]);

export const staffInviteSchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
  email: z.string().trim().email('Enter a valid email'),
  role: staffRoleSchema,
  title: z.string().trim().max(80).optional(),
  permissions: z.array(z.string()).default([]),
});
export type StaffInviteInput = z.infer<typeof staffInviteSchema>;

export const staffInviteAcceptSchema = z.object({
  token: z.string().min(10),
  fullName: z.string().trim().min(2).max(120),
  password: z.string().min(8).max(72),
});
export type StaffInviteAcceptInput = z.infer<typeof staffInviteAcceptSchema>;

export const staffRoleUpdateSchema = z.object({
  role: staffRoleSchema,
  title: z.string().trim().max(80).nullable().optional(),
});
export type StaffRoleUpdateInput = z.infer<typeof staffRoleUpdateSchema>;

export const staffPermissionsUpdateSchema = z.object({
  permissions: z.array(z.string()),
});
export type StaffPermissionsUpdateInput = z.infer<typeof staffPermissionsUpdateSchema>;

export const clinicSettingsUpdateSchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
  currency: z.string().trim().length(3).optional(),
  defaultConsultationDurationMinutes: z.coerce.number().int().min(5).max(180).optional(),
  bufferMinutes: z.coerce.number().int().min(0).max(60).optional(),
  cancellationPolicy: z.string().trim().max(1000).nullable().optional(),
  noShowPolicy: z.string().trim().max(1000).nullable().optional(),
  queueEnabled: z.boolean().optional(),
  tokenPrefix: z.string().trim().max(10).nullable().optional(),
  startingTokenNumber: z.coerce.number().int().min(1).max(1000).optional(),
  dailyTokenReset: z.boolean().optional(),
  priorityQueueEnabled: z.boolean().optional(),
  emergencyPriorityEnabled: z.boolean().optional(),
  appointmentNotificationsEnabled: z.boolean().optional(),
  queueNotificationsEnabled: z.boolean().optional(),
  delayNotificationsEnabled: z.boolean().optional(),
  reminderMinutesBefore: z.coerce.number().int().min(0).max(1440).nullable().optional(),
  patientDataVisibility: z.nativeEnum(PatientDataVisibility).optional(),
});
export type ClinicSettingsUpdateInput = z.infer<typeof clinicSettingsUpdateSchema>;

export const clinicAuditLogQuerySchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  actorUserId: z.string().uuid().optional(),
  action: z.string().trim().max(100).optional(),
  entityType: z.string().trim().max(60).optional(),
  entityId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ClinicAuditLogQuery = z.infer<typeof clinicAuditLogQuerySchema>;

export const clinicReportsQuerySchema = z
  .object({
    clinicId: z.string().uuid('Select a clinic'),
    from: z.string().date('Enter a valid date'),
    to: z.string().date('Enter a valid date'),
  })
  .refine((d) => d.from <= d.to, { message: 'From date must be on or before to date', path: ['to'] });
export type ClinicReportsQuery = z.infer<typeof clinicReportsQuerySchema>;

export const clinicPaginationQuerySchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ClinicPaginationQuery = z.infer<typeof clinicPaginationQuerySchema>;

export const staffListQuerySchema = clinicPaginationQuerySchema.extend({
  role: staffRoleSchema.optional(),
});
export type StaffListQuery = z.infer<typeof staffListQuerySchema>;
