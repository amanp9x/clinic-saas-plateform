import type { PatientMedicalHistoryDto } from '@clinic/shared';
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
import { NotFoundError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';

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
};
