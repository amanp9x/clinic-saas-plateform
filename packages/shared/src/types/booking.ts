import type { AppointmentType, BookingSource, ConsultationType, SlotStatus } from '../enums.js';

export interface AvailableSlotDto {
  startAt: string;
  endAt: string;
  status: SlotStatus;
  consultationType: ConsultationType;
  durationMinutes: number;
  feeRupees: number | null;
}

export type SlotClosedReason =
  | 'DOCTOR_NOT_ACCEPTING'
  | 'CLINIC_CLOSED'
  | 'CLINIC_HOLIDAY'
  | 'DOCTOR_ON_LEAVE'
  | 'NO_SESSIONS_TODAY'
  | 'CLINIC_SUSPENDED';

export interface AvailabilityResultDto {
  date: string;
  doctor: { id: string; displayName: string; profileImageUrl: string | null };
  clinic: { id: string; name: string };
  slots: AvailableSlotDto[];
  closedReason: SlotClosedReason | null;
}

export interface SlotHoldDto {
  id: string;
  doctorId: string;
  clinicId: string;
  scheduledAt: string;
  durationMinutes: number;
  consultationType: ConsultationType;
  expiresAt: string;
}

export interface BookingConfirmationDto {
  id: string;
  bookingReference: string;
  doctorId: string;
  doctorName: string;
  clinicId: string;
  clinicName: string;
  scheduledAt: string;
  durationMinutes: number | null;
  consultationType: ConsultationType;
  appointmentType: AppointmentType;
  consultationFee: string | null;
  status: string;
  bookingSource: BookingSource;
}

export interface BlockedSlotDto {
  id: string;
  doctorId: string | null;
  clinicId: string;
  startAt: string;
  endAt: string;
  reason: string;
  isActive: boolean;
}

