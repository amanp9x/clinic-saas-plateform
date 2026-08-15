/**
 * Central enum definitions shared between apps/api and apps/web.
 * Mirrors the Prisma schema enums — keep in sync with apps/api/prisma/schema.prisma.
 *
 * Modeled as `const` objects + derived string-literal-union types (Prisma's own
 * convention) rather than TypeScript `enum`, so Prisma's generated enum types are
 * structurally assignable to these without casting at the API/DB boundary.
 */

export const UserRole = {
  GUEST: 'GUEST',
  PATIENT: 'PATIENT',
  DOCTOR: 'DOCTOR',
  RECEPTIONIST: 'RECEPTIONIST',
  CLINIC_STAFF: 'CLINIC_STAFF',
  CLINIC_ADMIN: 'CLINIC_ADMIN',
  HOSPITAL_ADMIN: 'HOSPITAL_ADMIN',
  LAB_PARTNER: 'LAB_PARTNER',
  PHARMACY_PARTNER: 'PHARMACY_PARTNER',
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const AppointmentStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  CHECKED_IN: 'CHECKED_IN',
  IN_CONSULTATION: 'IN_CONSULTATION',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW',
} as const;
export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

export const BookingSource = {
  PATIENT: 'PATIENT',
  RECEPTION: 'RECEPTION',
  DOCTOR: 'DOCTOR',
} as const;
export type BookingSource = (typeof BookingSource)[keyof typeof BookingSource];

/** "First visit vs repeat visit" — deliberately separate from ConsultationType, which already
 * means modality (IN_CLINIC/ONLINE) and carries legacy FOLLOW_UP/EMERGENCY values used by the
 * catalog-search filter on ClinicDoctor.consultationTypes. */
export const AppointmentType = {
  NEW_CONSULTATION: 'NEW_CONSULTATION',
  FOLLOW_UP: 'FOLLOW_UP',
} as const;
export type AppointmentType = (typeof AppointmentType)[keyof typeof AppointmentType];

/** SlotHold lifecycle only — not the product-facing "6 slot states" (AVAILABLE/HELD/BOOKED/
 * BLOCKED/EXPIRED/CANCELLED), which is a read-time display computation, not a persisted state. */
export const SlotHoldStatus = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  RELEASED: 'RELEASED',
} as const;
export type SlotHoldStatus = (typeof SlotHoldStatus)[keyof typeof SlotHoldStatus];

/** Display-only status for a single generated slot in an availability response — never persisted
 * as-is; derived live from Appointment/SlotHold/BlockedSlot at read time. */
export const SlotStatus = {
  AVAILABLE: 'AVAILABLE',
  HELD: 'HELD',
  BOOKED: 'BOOKED',
  BLOCKED: 'BLOCKED',
} as const;
export type SlotStatus = (typeof SlotStatus)[keyof typeof SlotStatus];

/** Doctor's manually-set availability/session status for a clinic session. Staff-controlled, never inferred. */
export const DoctorSessionStatus = {
  NOT_ARRIVED: 'NOT_ARRIVED',
  ARRIVED: 'ARRIVED',
  AVAILABLE: 'AVAILABLE',
  IN_CONSULTATION: 'IN_CONSULTATION',
  ON_BREAK: 'ON_BREAK',
  DELAYED: 'DELAYED',
  UNAVAILABLE: 'UNAVAILABLE',
  SESSION_ENDED: 'SESSION_ENDED',
} as const;
export type DoctorSessionStatus = (typeof DoctorSessionStatus)[keyof typeof DoctorSessionStatus];

export const QueueStatus = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  CLOSED: 'CLOSED',
} as const;
export type QueueStatus = (typeof QueueStatus)[keyof typeof QueueStatus];

export const TokenStatus = {
  WAITING: 'WAITING',
  CALLED: 'CALLED',
  IN_CONSULTATION: 'IN_CONSULTATION',
  COMPLETED: 'COMPLETED',
  SKIPPED: 'SKIPPED',
  NO_SHOW: 'NO_SHOW',
  CANCELLED: 'CANCELLED',
} as const;
export type TokenStatus = (typeof TokenStatus)[keyof typeof TokenStatus];

export const TokenType = {
  SCHEDULED: 'SCHEDULED',
  WALK_IN: 'WALK_IN',
  EMERGENCY: 'EMERGENCY',
} as const;
export type TokenType = (typeof TokenType)[keyof typeof TokenType];

/** Queue-ordering priority, distinct from `TokenType` (which is about origin, not urgency).
 * Deterministic rank order: EMERGENCY > URGENT > FOLLOW_UP > NORMAL. */
export const TokenPriority = {
  NORMAL: 'NORMAL',
  FOLLOW_UP: 'FOLLOW_UP',
  URGENT: 'URGENT',
  EMERGENCY: 'EMERGENCY',
} as const;
export type TokenPriority = (typeof TokenPriority)[keyof typeof TokenPriority];

export const AuthProvider = {
  PASSWORD: 'PASSWORD',
  OTP: 'OTP',
  GOOGLE: 'GOOGLE',
} as const;
export type AuthProvider = (typeof AuthProvider)[keyof typeof AuthProvider];

export const ConsultationStatus = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const;
export type ConsultationStatus = (typeof ConsultationStatus)[keyof typeof ConsultationStatus];

export const PrescriptionStatus = {
  DRAFT: 'DRAFT',
  FINALIZED: 'FINALIZED',
} as const;
export type PrescriptionStatus = (typeof PrescriptionStatus)[keyof typeof PrescriptionStatus];

export const FoodTiming = {
  BEFORE_FOOD: 'BEFORE_FOOD',
  AFTER_FOOD: 'AFTER_FOOD',
  WITH_FOOD: 'WITH_FOOD',
  ANYTIME: 'ANYTIME',
} as const;
export type FoodTiming = (typeof FoodTiming)[keyof typeof FoodTiming];

export const LeaveType = {
  LEAVE: 'LEAVE',
  HOLIDAY: 'HOLIDAY',
} as const;
export type LeaveType = (typeof LeaveType)[keyof typeof LeaveType];

export const Gender = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  OTHER: 'OTHER',
  UNDISCLOSED: 'UNDISCLOSED',
} as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

export const Weekday = {
  MON: 'MON',
  TUE: 'TUE',
  WED: 'WED',
  THU: 'THU',
  FRI: 'FRI',
  SAT: 'SAT',
  SUN: 'SUN',
} as const;
export type Weekday = (typeof Weekday)[keyof typeof Weekday];

// ---------------------------------------------------------------------------
// Clinic Management (Phase 6)
// ---------------------------------------------------------------------------

export const ClinicOperatingStatus = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  TEMPORARILY_CLOSED: 'TEMPORARILY_CLOSED',
  SUSPENDED: 'SUSPENDED',
} as const;
export type ClinicOperatingStatus = (typeof ClinicOperatingStatus)[keyof typeof ClinicOperatingStatus];

export const ClinicVerificationStatus = {
  PENDING: 'PENDING',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED',
} as const;
export type ClinicVerificationStatus = (typeof ClinicVerificationStatus)[keyof typeof ClinicVerificationStatus];

export const ClinicDocumentType = {
  REGISTRATION_CERTIFICATE: 'REGISTRATION_CERTIFICATE',
  LICENSE: 'LICENSE',
  TAX_DOCUMENT: 'TAX_DOCUMENT',
  OTHER: 'OTHER',
} as const;
export type ClinicDocumentType = (typeof ClinicDocumentType)[keyof typeof ClinicDocumentType];

export const ClinicDocumentStatus = {
  UPLOADED: 'UPLOADED',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
} as const;
export type ClinicDocumentStatus = (typeof ClinicDocumentStatus)[keyof typeof ClinicDocumentStatus];

export const ClinicDoctorStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;
export type ClinicDoctorStatus = (typeof ClinicDoctorStatus)[keyof typeof ClinicDoctorStatus];

export const ConsultationType = {
  IN_CLINIC: 'IN_CLINIC',
  ONLINE: 'ONLINE',
  FOLLOW_UP: 'FOLLOW_UP',
  EMERGENCY: 'EMERGENCY',
} as const;
export type ConsultationType = (typeof ConsultationType)[keyof typeof ConsultationType];

export const ClinicResourceType = {
  CONSULTATION_ROOM: 'CONSULTATION_ROOM',
  PROCEDURE_ROOM: 'PROCEDURE_ROOM',
  OTHER: 'OTHER',
} as const;
export type ClinicResourceType = (typeof ClinicResourceType)[keyof typeof ClinicResourceType];

export const ClinicResourceStatus = {
  AVAILABLE: 'AVAILABLE',
  OCCUPIED: 'OCCUPIED',
  MAINTENANCE: 'MAINTENANCE',
  INACTIVE: 'INACTIVE',
} as const;
export type ClinicResourceStatus = (typeof ClinicResourceStatus)[keyof typeof ClinicResourceStatus];

export const StaffInvitationStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
} as const;
export type StaffInvitationStatus = (typeof StaffInvitationStatus)[keyof typeof StaffInvitationStatus];

export const PatientDataVisibility = {
  LIMITED: 'LIMITED',
  FULL: 'FULL',
} as const;
export type PatientDataVisibility = (typeof PatientDataVisibility)[keyof typeof PatientDataVisibility];
