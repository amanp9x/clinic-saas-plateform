import type { ReceptionAppointmentDetailDto, ReceptionAppointmentSummaryDto } from '@clinic/shared';
import { calculateAge } from '../../utils/age.js';
import type { ReceptionAppointmentWithRelations } from './reception-appointments.repository.js';

export function toReceptionAppointmentSummary(a: ReceptionAppointmentWithRelations, queuePosition: number | null): ReceptionAppointmentSummaryDto {
  return {
    id: a.id,
    patientId: a.patientId,
    patientName: a.patient.fullName,
    patientPhone: a.patient.user.phone,
    tokenNumber: a.queueToken?.tokenNumber ?? null,
    doctorId: a.doctorId,
    doctorName: a.doctor.displayName,
    clinicId: a.clinicId,
    scheduledAt: a.scheduledAt.toISOString(),
    reasonForVisit: a.reasonForVisit,
    bookingSource: a.queueToken?.type ?? 'BOOKED',
    status: a.status,
    tokenStatus: a.queueToken?.status ?? null,
    queuePosition,
    priority: a.queueToken?.priority ?? null,
    paymentStatus: a.payment?.status ?? null,
  };
}

export function toReceptionAppointmentDetail(a: ReceptionAppointmentWithRelations, queuePosition: number | null): ReceptionAppointmentDetailDto {
  return {
    ...toReceptionAppointmentSummary(a, queuePosition),
    patientAge: calculateAge(a.patient.dateOfBirth),
    patientGender: a.patient.gender,
    consultationFee: a.consultationFee ? a.consultationFee.toString() : null,
    createdAt: a.createdAt.toISOString(),
  };
}
