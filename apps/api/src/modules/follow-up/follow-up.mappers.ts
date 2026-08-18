import type { DoctorPrescriptionDto, FollowUpRowDto } from '@clinic/shared';
import type { Prescription, PrescriptionItem } from '@prisma/client';
import { toPrescriptionItemDto } from '../doctor-prescription/prescription.mappers.js';
import type { FollowUpRowWithRelations } from './follow-up.repository.js';

export function toFollowUpRowDto(row: FollowUpRowWithRelations, now = new Date()): FollowUpRowDto {
  return {
    consultationId: row.id,
    appointmentId: row.appointmentId,
    patientId: row.patient.id,
    patientName: row.patient.fullName,
    patientPhone: row.patient.user.phone,
    doctorId: row.doctor.id,
    doctorName: row.doctor.displayName,
    clinicId: row.clinic.id,
    clinicName: row.clinic.name,
    followUpDate: row.followUpDate!.toISOString(),
    diagnosis: row.diagnosis,
    isOverdue: row.followUpDate!.getTime() < now.getTime(),
  };
}

/** Structurally produces the existing `DoctorPrescriptionDto` shape (reused as-is, no parallel
 * patient-facing prescription DTO) without requiring the full `PrescriptionWithRelations` include
 * (doctor/appointment.clinic) that `toDoctorPrescriptionDto` needs only to satisfy its input type,
 * not to read from — this variant only ever needs `items` for its own fields. */
export function toVisitPrescriptionDto(prescription: Prescription & { items: PrescriptionItem[] }, patientName: string): DoctorPrescriptionDto {
  return {
    id: prescription.id,
    patientId: prescription.patientId,
    patientName,
    appointmentId: prescription.appointmentId,
    consultationId: prescription.consultationId,
    status: prescription.status,
    diagnosis: prescription.diagnosis,
    advice: prescription.advice,
    followUpDate: prescription.followUpDate ? prescription.followUpDate.toISOString() : null,
    labTestRecommendation: prescription.labTestRecommendation,
    items: prescription.items.map(toPrescriptionItemDto),
    notes: prescription.notes,
    signedAt: prescription.signedAt ? prescription.signedAt.toISOString() : null,
    signatureImageUrl: prescription.signatureImageUrl,
    pdfUrl: prescription.pdfUrl,
    issuedAt: prescription.issuedAt.toISOString(),
  };
}
