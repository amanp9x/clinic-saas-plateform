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
