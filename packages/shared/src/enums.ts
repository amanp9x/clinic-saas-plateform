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

// ---------------------------------------------------------------------------
// Payments & Billing Engine (Phase 9)
// ---------------------------------------------------------------------------

export const PaymentProvider = {
  MOCK: 'MOCK',
  RAZORPAY: 'RAZORPAY',
  STRIPE: 'STRIPE',
} as const;
export type PaymentProvider = (typeof PaymentProvider)[keyof typeof PaymentProvider];

/** Payment (order-level) transaction lifecycle — deliberately a separate enum from the existing
 * `PaymentStatus` (PENDING/PAID/WAIVED) walk-in intake flag on Appointment, which predates this
 * engine and remains reception's simple "did the desk collect cash" toggle. */
export const PaymentTransactionStatus = {
  CREATED: 'CREATED',
  PENDING: 'PENDING',
  AUTHORIZED: 'AUTHORIZED',
  CAPTURED: 'CAPTURED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  REFUND_PENDING: 'REFUND_PENDING',
  REFUNDED: 'REFUNDED',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
} as const;
export type PaymentTransactionStatus = (typeof PaymentTransactionStatus)[keyof typeof PaymentTransactionStatus];

export const PaymentAttemptStatus = {
  CREATED: 'CREATED',
  PENDING: 'PENDING',
  AUTHORIZED: 'AUTHORIZED',
  CAPTURED: 'CAPTURED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;
export type PaymentAttemptStatus = (typeof PaymentAttemptStatus)[keyof typeof PaymentAttemptStatus];

export const PaymentMethod = {
  UPI: 'UPI',
  CARD: 'CARD',
  NETBANKING: 'NETBANKING',
  WALLET: 'WALLET',
  OTHER: 'OTHER',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const RefundStatus = {
  REFUND_PENDING: 'REFUND_PENDING',
  REFUNDED: 'REFUNDED',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
  FAILED: 'FAILED',
} as const;
export type RefundStatus = (typeof RefundStatus)[keyof typeof RefundStatus];

// ---------------------------------------------------------------------------
// Notifications & Communication Engine (Phase 10)
// ---------------------------------------------------------------------------

/** Legacy generic types (APPOINTMENT_UPDATE/QUEUE_UPDATE/SYSTEM) predate the granular event-typed
 * notifications below and exist only for rows persisted before Phase 10. */
export const NotificationType = {
  APPOINTMENT_UPDATE: 'APPOINTMENT_UPDATE',
  QUEUE_UPDATE: 'QUEUE_UPDATE',
  PRESCRIPTION_READY: 'PRESCRIPTION_READY',
  REPORT_READY: 'REPORT_READY',
  SYSTEM: 'SYSTEM',

  APPOINTMENT_BOOKED: 'APPOINTMENT_BOOKED',
  APPOINTMENT_CONFIRMED: 'APPOINTMENT_CONFIRMED',
  APPOINTMENT_RESCHEDULED: 'APPOINTMENT_RESCHEDULED',
  APPOINTMENT_CANCELLED: 'APPOINTMENT_CANCELLED',
  APPOINTMENT_CHECKED_IN: 'APPOINTMENT_CHECKED_IN',
  APPOINTMENT_NO_SHOW: 'APPOINTMENT_NO_SHOW',
  APPOINTMENT_REMINDER: 'APPOINTMENT_REMINDER',
  APPOINTMENT_STARTING_SOON: 'APPOINTMENT_STARTING_SOON',

  PAYMENT_PENDING: 'PAYMENT_PENDING',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_REFUNDED: 'PAYMENT_REFUNDED',
  PAYMENT_REFUND_PENDING: 'PAYMENT_REFUND_PENDING',

  QUEUE_CHECKED_IN: 'QUEUE_CHECKED_IN',
  PATIENT_CALLED: 'PATIENT_CALLED',
  PATIENT_SKIPPED: 'PATIENT_SKIPPED',
  QUEUE_DELAY_UPDATED: 'QUEUE_DELAY_UPDATED',
  DOCTOR_DELAYED: 'DOCTOR_DELAYED',
  DOCTOR_ON_TIME: 'DOCTOR_ON_TIME',
  QUEUE_PAUSED: 'QUEUE_PAUSED',
  QUEUE_RESUMED: 'QUEUE_RESUMED',

  CONSULTATION_STARTED: 'CONSULTATION_STARTED',
  CONSULTATION_COMPLETED: 'CONSULTATION_COMPLETED',

  DOCTOR_STATUS_CHANGED: 'DOCTOR_STATUS_CHANGED',

  CLINIC_ANNOUNCEMENT: 'CLINIC_ANNOUNCEMENT',

  REVIEW_RECEIVED: 'REVIEW_RECEIVED',
  REVIEW_RESPONSE: 'REVIEW_RESPONSE',

  SECURITY_LOGIN: 'SECURITY_LOGIN',
  SECURITY_PASSWORD_CHANGED: 'SECURITY_PASSWORD_CHANGED',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

/** Governs whether a notification can be suppressed by user preference — TRANSACTIONAL/SECURITY
 * always deliver both channels regardless of NotificationPreference. */
export const NotificationTier = {
  TRANSACTIONAL: 'TRANSACTIONAL',
  SECURITY: 'SECURITY',
  OPTIONAL: 'OPTIONAL',
} as const;
export type NotificationTier = (typeof NotificationTier)[keyof typeof NotificationTier];

export const NotificationPriority = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;
export type NotificationPriority = (typeof NotificationPriority)[keyof typeof NotificationPriority];

export const NotificationDeliveryStatus = {
  QUEUED: 'QUEUED',
  SENDING: 'SENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;
export type NotificationDeliveryStatus = (typeof NotificationDeliveryStatus)[keyof typeof NotificationDeliveryStatus];

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
