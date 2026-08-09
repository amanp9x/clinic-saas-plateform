import { medicalRecordsRepository } from './medical-records.repository.js';
import {
  labReportToDownload,
  prescriptionToDownload,
  toLabReportDto,
  toMedicalRecordDto,
  toPrescriptionDto,
  toVaccinationDto,
  toVitalRecordDto,
} from './medical-records.mappers.js';
import { patientRepository } from '../patient/patient.repository.js';
import { NotFoundError } from '../../utils/app-error.js';

async function resolvePatientId(userId: string): Promise<string> {
  const patient = await patientRepository.findByUserId(userId);
  if (!patient) {
    throw new NotFoundError('Patient profile');
  }
  return patient.id;
}

export const medicalRecordsService = {
  async history(userId: string) {
    const patientId = await resolvePatientId(userId);
    const records = await medicalRecordsRepository.listHistory(patientId);
    return records.map(toMedicalRecordDto);
  },

  async prescriptions(userId: string) {
    const patientId = await resolvePatientId(userId);
    const prescriptions = await medicalRecordsRepository.listPrescriptions(patientId);
    return prescriptions.map(toPrescriptionDto);
  },

  async labReports(userId: string) {
    const patientId = await resolvePatientId(userId);
    const reports = await medicalRecordsRepository.listLabReports(patientId);
    return reports.map(toLabReportDto);
  },

  async vaccinations(userId: string) {
    const patientId = await resolvePatientId(userId);
    const vaccinations = await medicalRecordsRepository.listVaccinations(patientId);
    return vaccinations.map(toVaccinationDto);
  },

  async vitals(userId: string) {
    const patientId = await resolvePatientId(userId);
    const vitals = await medicalRecordsRepository.listVitals(patientId);
    return vitals.map(toVitalRecordDto);
  },

  async downloads(userId: string) {
    const patientId = await resolvePatientId(userId);
    const [prescriptions, reports] = await Promise.all([
      medicalRecordsRepository.listPrescriptions(patientId),
      medicalRecordsRepository.listLabReports(patientId),
    ]);

    const items = [
      ...prescriptions.map(prescriptionToDownload),
      ...reports.map(labReportToDownload),
    ].filter((item): item is NonNullable<typeof item> => item !== null);

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items;
  },
};
