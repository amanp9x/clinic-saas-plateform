import type { RefillRequestDto } from '@clinic/shared';
import type { RefillRequestWithRelations } from './prescription-refill.repository.js';

export function toRefillRequestDto(request: RefillRequestWithRelations): RefillRequestDto {
  return {
    id: request.id,
    prescriptionId: request.prescriptionId,
    patientId: request.patientId,
    patientName: request.patient.fullName,
    doctorId: request.doctorId,
    doctorName: request.doctor.displayName,
    status: request.status,
    patientNote: request.patientNote,
    doctorNote: request.doctorNote,
    requestedAt: request.requestedAt.toISOString(),
    respondedAt: request.respondedAt ? request.respondedAt.toISOString() : null,
    issuedPrescriptionId: request.issuedPrescriptionId,
    originalPrescription: {
      diagnosis: request.prescription.diagnosis,
      issuedAt: request.prescription.issuedAt.toISOString(),
      medicineNames: request.prescription.items.map((item) => item.medicineName),
    },
  };
}
