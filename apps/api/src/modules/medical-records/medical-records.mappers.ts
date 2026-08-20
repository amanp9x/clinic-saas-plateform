import type { Doctor, LabReport, MedicalRecord, Prescription, Vaccination, VitalRecord } from '@prisma/client';
import type {
  DownloadItemDto,
  LabReportDto,
  MedicalRecordDto,
  MedicationItem,
  PrescriptionDto,
  VaccinationDto,
  VitalRecordDto,
} from '@clinic/shared';

function parseMedications(value: unknown): MedicationItem[] {
  return Array.isArray(value) ? (value as MedicationItem[]) : [];
}

export function toPrescriptionDto(prescription: Prescription & { doctor: Doctor }): PrescriptionDto {
  return {
    id: prescription.id,
    doctorName: prescription.doctor.displayName,
    appointmentId: prescription.appointmentId,
    issuedAt: prescription.issuedAt.toISOString(),
    medications: parseMedications(prescription.medications),
    notes: prescription.notes,
    fileUrl: prescription.fileUrl,
    status: prescription.status,
  };
}

export function toLabReportDto(report: LabReport): LabReportDto {
  return {
    id: report.id,
    testName: report.testName,
    labName: report.labName,
    status: report.status,
    reportDate: report.reportDate ? report.reportDate.toISOString() : null,
    fileUrl: report.fileUrl,
    notes: report.notes,
    appointmentId: report.appointmentId,
  };
}

export function toVaccinationDto(vaccination: Vaccination): VaccinationDto {
  return {
    id: vaccination.id,
    vaccineName: vaccination.vaccineName,
    doseNumber: vaccination.doseNumber,
    administeredDate: vaccination.administeredDate.toISOString(),
    nextDueDate: vaccination.nextDueDate ? vaccination.nextDueDate.toISOString() : null,
    administeredBy: vaccination.administeredBy,
    notes: vaccination.notes,
  };
}

export function toVitalRecordDto(vital: VitalRecord): VitalRecordDto {
  return {
    id: vital.id,
    recordedAt: vital.recordedAt.toISOString(),
    heightCm: vital.heightCm,
    weightKg: vital.weightKg,
    bloodPressureSystolic: vital.bloodPressureSystolic,
    bloodPressureDiastolic: vital.bloodPressureDiastolic,
    heartRateBpm: vital.heartRateBpm,
    temperatureCelsius: vital.temperatureCelsius,
    bloodSugarMgDl: vital.bloodSugarMgDl,
    notes: vital.notes,
  };
}

export function toMedicalRecordDto(record: MedicalRecord): MedicalRecordDto {
  return {
    id: record.id,
    recordType: record.recordType,
    title: record.title,
    description: record.description,
    recordDate: record.recordDate.toISOString(),
    doctorName: record.doctorName,
    attachmentUrl: record.attachmentUrl,
  };
}

export function prescriptionToDownload(prescription: Prescription & { doctor: Doctor }): DownloadItemDto | null {
  if (!prescription.fileUrl) return null;
  return {
    id: prescription.id,
    kind: 'PRESCRIPTION',
    title: `Prescription — ${prescription.doctor.displayName}`,
    date: prescription.issuedAt.toISOString(),
    fileUrl: prescription.fileUrl,
  };
}

export function labReportToDownload(report: LabReport): DownloadItemDto | null {
  if (!report.fileUrl) return null;
  return {
    id: report.id,
    kind: 'LAB_REPORT',
    title: report.testName,
    date: (report.reportDate ?? report.createdAt).toISOString(),
    fileUrl: report.fileUrl,
  };
}
