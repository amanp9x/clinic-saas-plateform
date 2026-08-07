import type {
  ClinicSearchInput,
  DoctorSearchInput,
  HospitalSearchInput,
  PaginatedResult,
} from '@clinic/shared';
import { catalogRepository } from './catalog.repository.js';
import {
  toArticleDto,
  toClinicSummary,
  toDoctorDetail,
  toDoctorSummary,
  toHospitalSummary,
  toSpecializationSummary,
  toTestimonialDto,
} from './catalog.mappers.js';
import { NotFoundError } from '../../utils/app-error.js';

function paginate<T>(items: T[], total: number, page: number, limit: number): PaginatedResult<T> {
  return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export const catalogService = {
  async searchDoctors(filters: DoctorSearchInput) {
    const { items, total } = await catalogRepository.listDoctors(filters);
    return paginate(items.map(toDoctorSummary), total, filters.page, filters.limit);
  },

  async getDoctorBySlug(slug: string) {
    const doctor = await catalogRepository.findDoctorBySlug(slug);
    if (!doctor) {
      throw new NotFoundError('Doctor');
    }
    const similar = await catalogRepository.listSimilarDoctors(doctor.specializationId, doctor.id);
    return {
      doctor: toDoctorDetail(doctor),
      similarDoctors: similar.map(toDoctorSummary),
    };
  },

  async listSpecializations() {
    const specializations = await catalogRepository.listSpecializations();
    return specializations.map(toSpecializationSummary);
  },

  async searchClinics(filters: ClinicSearchInput) {
    const { items, total } = await catalogRepository.listClinics(filters);
    return paginate(items.map(toClinicSummary), total, filters.page, filters.limit);
  },

  async searchHospitals(filters: HospitalSearchInput) {
    const { items, total } = await catalogRepository.listHospitals(filters);
    return paginate(items.map(toHospitalSummary), total, filters.page, filters.limit);
  },

  async listTestimonials(limit: number) {
    const testimonials = await catalogRepository.listTestimonials(limit);
    return testimonials.map(toTestimonialDto);
  },

  async listArticles(limit: number) {
    const articles = await catalogRepository.listArticles(limit);
    return articles.map(toArticleDto);
  },

  async listCities() {
    const rows = await catalogRepository.distinctCities();
    return rows.map((r) => r.city).filter((city): city is string => Boolean(city));
  },
};
