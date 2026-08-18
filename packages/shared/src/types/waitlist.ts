import type { ConsultationType } from '../enums.js';

/** Phase 13 — Appointment Waitlist. */

export const WAITLIST_STATUSES = ['ACTIVE', 'NOTIFIED', 'FULFILLED', 'CANCELLED'] as const;
export type WaitlistStatusValue = (typeof WAITLIST_STATUSES)[number];

/** DTO-level status only — EXPIRED is never stored (see WaitlistEntry's schema comment); it is
 * computed at read time whenever `targetDate` has passed while still ACTIVE/NOTIFIED. */
export const WAITLIST_DISPLAY_STATUSES = [...WAITLIST_STATUSES, 'EXPIRED'] as const;
export type WaitlistDisplayStatus = (typeof WAITLIST_DISPLAY_STATUSES)[number];

/** A patient's own waitlist entry — "My Waitlist". */
export interface WaitlistEntryDto {
  id: string;
  doctorId: string;
  doctorName: string;
  doctorSlug: string;
  clinicId: string;
  clinicName: string;
  targetDate: string;
  consultationType: ConsultationType | null;
  notes: string | null;
  status: WaitlistDisplayStatus;
  notifiedAt: string | null;
  fulfilledAppointmentId: string | null;
  /** Server-computed — true only for ACTIVE/NOTIFIED (and not yet past its targetDate). */
  canCancel: boolean;
  createdAt: string;
}

/** A row in the clinic's waitlist queue (reception/clinic-admin view) — includes the
 * public-safe patient identity fields reception already sees elsewhere (name/phone), never
 * email or any medical data. */
export interface ClinicWaitlistRowDto {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  doctorId: string;
  doctorName: string;
  targetDate: string;
  consultationType: ConsultationType | null;
  notes: string | null;
  status: WaitlistDisplayStatus;
  notifiedAt: string | null;
  createdAt: string;
}

/** Doctor's own read-only view of patients waiting for them. */
export interface DoctorWaitlistRowDto {
  id: string;
  clinicId: string;
  clinicName: string;
  targetDate: string;
  consultationType: ConsultationType | null;
  status: WaitlistDisplayStatus;
  notifiedAt: string | null;
  createdAt: string;
}
