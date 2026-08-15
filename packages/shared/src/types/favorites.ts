import type { ClinicSummary, DoctorSummary } from './catalog.js';

export interface FavoritesResult {
  doctors: DoctorSummary[];
  clinics: ClinicSummary[];
}
