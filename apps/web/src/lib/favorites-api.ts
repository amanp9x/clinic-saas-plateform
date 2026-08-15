import type { FavoritesResult } from '@clinic/shared';
import { apiFetch } from './api-client';

export function listFavorites() {
  return apiFetch<FavoritesResult>('/api/v1/favorites');
}

export function saveDoctorFavorite(doctorId: string) {
  return apiFetch<unknown>(`/api/v1/favorites/doctors/${doctorId}`, { method: 'POST' });
}

export function removeDoctorFavorite(doctorId: string) {
  return apiFetch<unknown>(`/api/v1/favorites/doctors/${doctorId}`, { method: 'DELETE' });
}

export function saveClinicFavorite(clinicId: string) {
  return apiFetch<unknown>(`/api/v1/favorites/clinics/${clinicId}`, { method: 'POST' });
}

export function removeClinicFavorite(clinicId: string) {
  return apiFetch<unknown>(`/api/v1/favorites/clinics/${clinicId}`, { method: 'DELETE' });
}
