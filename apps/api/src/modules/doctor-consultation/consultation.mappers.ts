import type { Consultation } from '@prisma/client';
import type { ConsultationDto } from '@clinic/shared';

export function toConsultationDto(consultation: Consultation): ConsultationDto {
  return {
    id: consultation.id,
    appointmentId: consultation.appointmentId,
    status: consultation.status,
    chiefComplaint: consultation.chiefComplaint,
    symptoms: consultation.symptoms,
    vitals: {
      heightCm: consultation.heightCm,
      weightKg: consultation.weightKg,
      temperatureC: consultation.temperatureC,
      bloodPressureSystolic: consultation.bloodPressureSystolic,
      bloodPressureDiastolic: consultation.bloodPressureDiastolic,
      pulseRate: consultation.pulseRate,
      respiratoryRate: consultation.respiratoryRate,
      spo2: consultation.spo2,
    },
    diagnosis: consultation.diagnosis,
    doctorNotes: consultation.doctorNotes,
    treatmentPlan: consultation.treatmentPlan,
    followUpDate: consultation.followUpDate ? consultation.followUpDate.toISOString() : null,
    startedAt: consultation.startedAt ? consultation.startedAt.toISOString() : null,
    completedAt: consultation.completedAt ? consultation.completedAt.toISOString() : null,
  };
}
