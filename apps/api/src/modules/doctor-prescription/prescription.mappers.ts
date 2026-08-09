import type { PrescriptionItem } from '@prisma/client';
import type { DoctorPrescriptionDto, PrescriptionItemDto } from '@clinic/shared';
import type { PrescriptionWithRelations } from './prescription.repository.js';

export function toPrescriptionItemDto(item: PrescriptionItem): PrescriptionItemDto {
  return {
    id: item.id,
    sortOrder: item.sortOrder,
    medicineName: item.medicineName,
    dosage: item.dosage,
    frequency: item.frequency,
    duration: item.duration,
    route: item.route,
    instructions: item.instructions,
    beforeAfterFood: item.beforeAfterFood,
    quantity: item.quantity,
  };
}

export function toDoctorPrescriptionDto(prescription: PrescriptionWithRelations): DoctorPrescriptionDto {
  return {
    id: prescription.id,
    patientId: prescription.patientId,
    patientName: prescription.patient.fullName,
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
