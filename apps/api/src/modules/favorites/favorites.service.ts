import type { FavoritesResult } from '@clinic/shared';
import { toClinicSummary, toDoctorSummary } from '../catalog/catalog.mappers.js';
import { patientRepository } from '../patient/patient.repository.js';
import { favoritesRepository } from './favorites.repository.js';
import { NotFoundError } from '../../utils/app-error.js';

export const favoritesService = {
  async addDoctorFavorite(userId: string, doctorId: string) {
    const patient = await patientRepository.findByUserIdOrThrow(userId);
    const doctor = await favoritesRepository.findActiveDoctor(doctorId);
    if (!doctor) {
      throw new NotFoundError('Doctor');
    }
    const existing = await favoritesRepository.findByPatientAndDoctor(patient.id, doctorId);
    if (existing) return existing;
    return favoritesRepository.createDoctorFavorite(patient.id, doctorId);
  },

  async removeDoctorFavorite(userId: string, doctorId: string) {
    const patient = await patientRepository.findByUserIdOrThrow(userId);
    const existing = await favoritesRepository.findByPatientAndDoctor(patient.id, doctorId);
    if (!existing) return;
    await favoritesRepository.deleteById(existing.id);
  },

  async addClinicFavorite(userId: string, clinicId: string) {
    const patient = await patientRepository.findByUserIdOrThrow(userId);
    const clinic = await favoritesRepository.findActiveClinic(clinicId);
    if (!clinic) {
      throw new NotFoundError('Clinic');
    }
    const existing = await favoritesRepository.findByPatientAndClinic(patient.id, clinicId);
    if (existing) return existing;
    return favoritesRepository.createClinicFavorite(patient.id, clinicId);
  },

  async removeClinicFavorite(userId: string, clinicId: string) {
    const patient = await patientRepository.findByUserIdOrThrow(userId);
    const existing = await favoritesRepository.findByPatientAndClinic(patient.id, clinicId);
    if (!existing) return;
    await favoritesRepository.deleteById(existing.id);
  },

  async list(userId: string): Promise<FavoritesResult> {
    const patient = await patientRepository.findByUserIdOrThrow(userId);
    const { doctorFavorites, clinicFavorites } = await favoritesRepository.listByPatient(patient.id);
    return {
      doctors: doctorFavorites.filter((f) => f.doctor).map((f) => toDoctorSummary(f.doctor!)),
      clinics: clinicFavorites.filter((f) => f.clinic).map((f) => toClinicSummary(f.clinic!)),
    };
  },
};
