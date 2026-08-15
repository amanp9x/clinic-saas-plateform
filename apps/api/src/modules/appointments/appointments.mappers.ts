import type { AppointmentDetailDto, AppointmentSummaryDto } from '@clinic/shared';
import type { AppointmentWithRelations } from './appointments.repository.js';

export function toAppointmentSummary(appointment: AppointmentWithRelations): AppointmentSummaryDto {
  return {
    id: appointment.id,
    bookingReference: appointment.bookingReference,
    doctorId: appointment.doctorId,
    doctorName: appointment.doctor.displayName,
    doctorSlug: appointment.doctor.slug,
    doctorProfileImageUrl: appointment.doctor.profileImageUrl,
    specializationName: appointment.doctor.specialization?.name ?? null,
    clinicId: appointment.clinicId,
    clinicName: appointment.clinic.name,
    clinicCity: appointment.clinic.city,
    scheduledAt: appointment.scheduledAt.toISOString(),
    durationMinutes: appointment.durationMinutes,
    consultationType: appointment.consultationType,
    appointmentType: appointment.appointmentType,
    status: appointment.status,
    tokenNumber: appointment.tokenNumber,
    reasonForVisit: appointment.reasonForVisit,
    consultationFee: appointment.consultationFee ? appointment.consultationFee.toString() : null,
    hasPrescription: appointment.prescriptions.length > 0,
  };
}

export function toAppointmentDetail(appointment: AppointmentWithRelations): AppointmentDetailDto {
  return {
    ...toAppointmentSummary(appointment),
    clinicAddress: [appointment.clinic.addressLine1, appointment.clinic.city, appointment.clinic.state]
      .filter(Boolean)
      .join(', ') || null,
    clinicPhone: appointment.clinic.phone,
    cancelReason: appointment.cancelReason,
    cancelledAt: appointment.cancelledAt ? appointment.cancelledAt.toISOString() : null,
    completedAt: appointment.completedAt ? appointment.completedAt.toISOString() : null,
    rescheduledAt: appointment.rescheduledAt ? appointment.rescheduledAt.toISOString() : null,
    previousScheduledAt: appointment.previousScheduledAt ? appointment.previousScheduledAt.toISOString() : null,
    rescheduleCount: appointment.rescheduleCount,
    createdAt: appointment.createdAt.toISOString(),
  };
}
