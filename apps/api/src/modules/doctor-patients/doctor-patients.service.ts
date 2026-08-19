import { NotificationType } from '@prisma/client';
import type { LabReportCreateInput, LabReportDto, LabReportUpdateInput, PatientMedicalHistoryDto, VaccinationCreateInput, VaccinationDto } from '@clinic/shared';
import { doctorPatientsRepository } from './doctor-patients.repository.js';
import { toDoctorPatientProfile } from './doctor-patients.mappers.js';
import { resolveDoctorOrThrow } from '../doctor/doctor.shared.js';
import { toAppointmentSummary } from '../appointments/appointments.mappers.js';
import { medicalRecordsRepository } from '../medical-records/medical-records.repository.js';
import {
  toLabReportDto,
  toMedicalRecordDto,
  toPrescriptionDto,
  toVaccinationDto,
  toVitalRecordDto,
} from '../medical-records/medical-records.mappers.js';
import { NotFoundError, ValidationError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';
import { notifyUser } from '../notifications/notification-dispatch.service.js';
import { saveUploadedFile } from '../../services/storage.service.js';

/** Continuity-of-care authorization: a doctor may view a patient's full record once ANY
 * appointment relationship exists between them, regardless of which doctor authored individual
 * entries. No relationship (or no such patient) surfaces the same 404 to avoid leaking existence. */
async function requireCareRelationship(doctorId: string, patientId: string) {
  const patient = await doctorPatientsRepository.findPatient(patientId);
  if (!patient) {
    throw new NotFoundError('Patient');
  }
  const authorized = await doctorPatientsRepository.hasCareRelationship(doctorId, patientId);
  if (!authorized) {
    throw new NotFoundError('Patient');
  }
  return patient;
}

export const doctorPatientsService = {
  async getProfile(userId: string, patientId: string) {
    const doctor = await resolveDoctorOrThrow(userId);
    const patient = await requireCareRelationship(doctor.id, patientId);
    recordAuditLog({
      actorUserId: userId,
      action: 'doctor.patient_profile_viewed',
      entityType: 'Patient',
      entityId: patientId,
    });
    return toDoctorPatientProfile(patient);
  },

  async getMedicalHistory(userId: string, patientId: string): Promise<PatientMedicalHistoryDto> {
    const doctor = await resolveDoctorOrThrow(userId);
    const patient = await requireCareRelationship(doctor.id, patientId);

    const [appointments, prescriptions, labReports, vaccinations, vitals, records] = await Promise.all([
      doctorPatientsRepository.listAppointments(patientId),
      medicalRecordsRepository.listPrescriptions(patientId),
      medicalRecordsRepository.listLabReports(patientId),
      medicalRecordsRepository.listVaccinations(patientId),
      medicalRecordsRepository.listVitals(patientId),
      medicalRecordsRepository.listHistory(patientId),
    ]);

    recordAuditLog({
      actorUserId: userId,
      action: 'doctor.patient_history_viewed',
      entityType: 'Patient',
      entityId: patientId,
    });

    return {
      profile: toDoctorPatientProfile(patient),
      appointments: appointments.map(toAppointmentSummary),
      prescriptions: prescriptions.map(toPrescriptionDto),
      labReports: labReports.map(toLabReportDto),
      vaccinations: vaccinations.map(toVaccinationDto),
      vitalRecords: vitals.map(toVitalRecordDto),
      medicalRecords: records.map(toMedicalRecordDto),
    };
  },

  /** Phase 18 — a doctor orders a test for a patient they have a care relationship with. Starts
   * PENDING; no result yet, so no patient notification fires here (only on the READY transition,
   * via `updateLabReport`). */
  async createLabReport(userId: string, patientId: string, input: LabReportCreateInput): Promise<LabReportDto> {
    const doctor = await resolveDoctorOrThrow(userId);
    await requireCareRelationship(doctor.id, patientId);

    const report = await doctorPatientsRepository.createLabReport(patientId, {
      testName: input.testName,
      labName: input.labName || null,
      appointmentId: input.appointmentId || null,
      notes: input.notes || null,
    });

    recordAuditLog({ actorUserId: userId, action: 'doctor.lab_report_created', entityType: 'LabReport', entityId: report.id, metadata: { patientId, testName: input.testName } });
    return toLabReportDto(report);
  },

  /** Updates result fields and/or attaches a report file. A `PENDING -> READY` transition
   * requires a report date (mirrors every other "this action needs a reason/date" validation
   * precedent in this codebase) and fires the previously-unused `REPORT_READY` notification,
   * idempotently — a duplicate/racing call for the same report never double-notifies, the same
   * unique-`notificationKey` guarantee every other reminder/notification in this codebase relies
   * on. */
  async updateLabReport(userId: string, patientId: string, reportId: string, input: LabReportUpdateInput, file?: Express.Multer.File): Promise<LabReportDto> {
    const doctor = await resolveDoctorOrThrow(userId);
    const patient = await requireCareRelationship(doctor.id, patientId);
    const existing = await doctorPatientsRepository.findLabReport(reportId, patientId);
    if (!existing) {
      throw new NotFoundError('Lab report');
    }

    const nextStatus = input.status ?? existing.status;
    if (nextStatus === 'READY' && !input.reportDate && !existing.reportDate) {
      throw new ValidationError('A report date is required to mark this report ready');
    }

    let fileUrl = existing.fileUrl;
    if (file) {
      const { url } = await saveUploadedFile({ buffer: file.buffer, originalName: file.originalname, subdirectory: `lab-reports/${patientId}` });
      fileUrl = url;
    }

    const updated = await doctorPatientsRepository.updateLabReport(reportId, {
      status: nextStatus,
      reportDate: input.reportDate ? new Date(input.reportDate) : existing.reportDate,
      notes: input.notes !== undefined ? input.notes || null : existing.notes,
      fileUrl,
    });

    recordAuditLog({ actorUserId: userId, action: 'doctor.lab_report_updated', entityType: 'LabReport', entityId: reportId, metadata: { patientId, status: updated.status } });

    if (updated.status === 'READY' && existing.status !== 'READY') {
      await notifyUser({
        userId: patient.userId,
        type: NotificationType.REPORT_READY,
        title: 'Lab report ready',
        message: `Your ${updated.testName} report is ready to view.`,
        relatedEntityType: 'LabReport',
        relatedEntityId: reportId,
        actionUrl: '/medical-records/reports',
        notificationKey: `lab-report:${reportId}:ready`,
      });
    }

    return toLabReportDto(updated);
  },

  /** A doctor records a vaccination they just administered — recorded once, at the time of
   * administration (unlike lab reports, there's no pending/result-later state), so no patient
   * notification is dispatched here — the patient was present when it happened. */
  async createVaccination(userId: string, patientId: string, input: VaccinationCreateInput): Promise<VaccinationDto> {
    const doctor = await resolveDoctorOrThrow(userId);
    await requireCareRelationship(doctor.id, patientId);

    const vaccination = await doctorPatientsRepository.createVaccination(patientId, {
      vaccineName: input.vaccineName,
      doseNumber: input.doseNumber ?? null,
      administeredDate: new Date(input.administeredDate),
      nextDueDate: input.nextDueDate ? new Date(input.nextDueDate) : null,
      administeredBy: input.administeredBy || null,
      notes: input.notes || null,
    });

    recordAuditLog({ actorUserId: userId, action: 'doctor.vaccination_recorded', entityType: 'Vaccination', entityId: vaccination.id, metadata: { patientId, vaccineName: input.vaccineName } });
    return toVaccinationDto(vaccination);
  },
};
