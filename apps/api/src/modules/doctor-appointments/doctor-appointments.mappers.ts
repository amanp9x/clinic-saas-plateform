import type { DoctorAppointmentDetailDto } from '@clinic/shared';
import { toDoctorAppointmentSummary } from '../doctor/doctor.mappers.js';
import type { DoctorAppointmentWithRelations } from './doctor-appointments.repository.js';

export function toDoctorAppointmentDetail(appointment: DoctorAppointmentWithRelations): DoctorAppointmentDetailDto {
  return {
    ...toDoctorAppointmentSummary(appointment),
    patientPhone: appointment.patient.user.phone,
    cancelReason: appointment.cancelReason,
    cancelledAt: appointment.cancelledAt ? appointment.cancelledAt.toISOString() : null,
    completedAt: appointment.completedAt ? appointment.completedAt.toISOString() : null,
    createdAt: appointment.createdAt.toISOString(),
    consultationStatus: appointment.consultation?.status ?? null,
  };
}
