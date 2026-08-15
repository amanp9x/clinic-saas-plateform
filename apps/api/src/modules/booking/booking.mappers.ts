import type { AvailabilityResultDto, AvailableSlotDto, BookingConfirmationDto, SlotHoldDto } from '@clinic/shared';
import type { AvailabilityResult } from './booking.availability.js';
import type { BookingAppointment } from './booking.engine.js';
import type { SlotHold } from '@prisma/client';

export function toAvailabilityResultDto(result: AvailabilityResult, date: string): AvailabilityResultDto {
  return {
    date,
    doctor: result.doctor,
    clinic: result.clinic,
    closedReason: result.closedReason,
    slots: result.slots.map(
      (s): AvailableSlotDto => ({
        startAt: s.startAt.toISOString(),
        endAt: s.endAt.toISOString(),
        status: s.status,
        consultationType: s.consultationType,
        durationMinutes: s.durationMinutes,
        feeRupees: s.feeRupees,
      }),
    ),
  };
}

export function toSlotHoldDto(hold: SlotHold): SlotHoldDto {
  return {
    id: hold.id,
    doctorId: hold.doctorId,
    clinicId: hold.clinicId,
    scheduledAt: hold.scheduledAt.toISOString(),
    durationMinutes: hold.durationMinutes,
    consultationType: hold.consultationType,
    expiresAt: hold.expiresAt.toISOString(),
  };
}

export function toBookingConfirmationDto(appointment: BookingAppointment): BookingConfirmationDto {
  return {
    id: appointment.id,
    bookingReference: appointment.bookingReference,
    doctorId: appointment.doctorId,
    doctorName: appointment.doctor.displayName,
    clinicId: appointment.clinicId,
    clinicName: appointment.clinic.name,
    scheduledAt: appointment.scheduledAt.toISOString(),
    durationMinutes: appointment.durationMinutes,
    consultationType: appointment.consultationType,
    appointmentType: appointment.appointmentType,
    consultationFee: appointment.consultationFee ? appointment.consultationFee.toString() : null,
    status: appointment.status,
    bookingSource: appointment.bookingSource,
  };
}
