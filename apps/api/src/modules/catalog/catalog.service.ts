import type {
  ClinicAffiliation,
  ClinicSearchInput,
  DoctorQueueStatus,
  DoctorSearchInput,
  HospitalSearchInput,
  NextAvailable,
  PaginatedResult,
} from '@clinic/shared';
import { computeNextAvailableSession, type LeaveRange } from '../../utils/availability.util.js';
import { catalogRepository, type DoctorWithDetailRelations } from './catalog.repository.js';
import {
  toArticleDto,
  toClinicAffiliation,
  toClinicDetail,
  toClinicSummary,
  toDoctorDetail,
  toDoctorSummary,
  toHospitalSummary,
  toPublicQueueSummary,
  toRatingBreakdown,
  toSpecializationSummary,
  toTestimonialDto,
} from './catalog.mappers.js';
import { NotFoundError } from '../../utils/app-error.js';

function paginate<T>(items: T[], total: number, page: number, limit: number): PaginatedResult<T> {
  return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

async function buildQueueStatus(doctorId: string, clinicId: string): Promise<DoctorQueueStatus> {
  const session = await catalogRepository.findTodaySession(doctorId, clinicId);
  if (!session) return toPublicQueueSummary(null, null, null);

  const [patientsAhead, currentTokenRow] = await Promise.all([
    catalogRepository.countWaitingTokens(session.id),
    session.currentTokenId ? catalogRepository.getCurrentTokenNumber(session.currentTokenId) : Promise.resolve(null),
  ]);

  return toPublicQueueSummary(session, currentTokenRow?.tokenNumber ?? null, patientsAhead);
}

async function buildClinicAffiliations(doctor: DoctorWithDetailRelations): Promise<ClinicAffiliation[]> {
  const doctorLeaves: LeaveRange[] = doctor.leaves.map((l) => ({
    startDate: l.startDate,
    endDate: l.endDate,
    clinicId: l.clinicId,
  }));

  return Promise.all(
    doctor.clinics.map(async (cd) => {
      const queueStatus = await buildQueueStatus(doctor.id, cd.clinicId);
      const nextAvailable = computeNextAvailableSession(cd.availability, doctorLeaves, cd.clinic.holidays, cd.clinicId);
      return toClinicAffiliation(cd, queueStatus, nextAvailable);
    }),
  );
}

/** Bulk, page-scoped `nextAvailable` computation for `sort=availability` — two queries for the
 * whole page rather than an N+1 per doctor. Picks the earliest date across a doctor's clinics. */
async function computeNextAvailableMap(doctorIds: string[]): Promise<Map<string, NextAvailable | null>> {
  const result = new Map<string, NextAvailable | null>(doctorIds.map((id) => [id, null]));
  if (doctorIds.length === 0) return result;

  const [contexts, leaves] = await Promise.all([
    catalogRepository.listAvailabilityContext(doctorIds),
    catalogRepository.listLeavesForDoctors(doctorIds),
  ]);

  const leavesByDoctor = new Map<string, LeaveRange[]>();
  for (const l of leaves) {
    const arr = leavesByDoctor.get(l.doctorId) ?? [];
    arr.push({ startDate: l.startDate, endDate: l.endDate, clinicId: l.clinicId });
    leavesByDoctor.set(l.doctorId, arr);
  }

  for (const ctx of contexts) {
    const next = computeNextAvailableSession(
      ctx.availability,
      leavesByDoctor.get(ctx.doctorId) ?? [],
      ctx.clinic.holidays,
      ctx.clinicId,
    );
    if (!next) continue;
    const current = result.get(ctx.doctorId);
    if (!current || next.date < current.date) {
      result.set(ctx.doctorId, next);
    }
  }

  return result;
}

export const catalogService = {
  async searchDoctors(filters: DoctorSearchInput) {
    const { items, total } = await catalogRepository.listDoctors(filters);
    let summaries = items.map(toDoctorSummary);

    if (filters.sort === 'availability') {
      const nextMap = await computeNextAvailableMap(items.map((d) => d.id));
      summaries = items
        .map((doctor, i) => ({ summary: summaries[i]!, next: nextMap.get(doctor.id) ?? null }))
        .sort((a, b) => {
          if (!a.next && !b.next) return 0;
          if (!a.next) return 1;
          if (!b.next) return -1;
          return a.next.date.localeCompare(b.next.date);
        })
        .map((w) => w.summary);
    }

    return paginate(summaries, total, filters.page, filters.limit);
  },

  async getDoctorBySlug(slug: string) {
    const doctor = await catalogRepository.findDoctorBySlug(slug);
    if (!doctor) {
      throw new NotFoundError('Doctor');
    }

    const [similar, ratingGroups, clinics] = await Promise.all([
      catalogRepository.listSimilarDoctors(doctor.specializationId, doctor.id),
      catalogRepository.groupDoctorReviewRatings(doctor.id),
      buildClinicAffiliations(doctor),
    ]);

    const ratingBreakdown = toRatingBreakdown(ratingGroups, doctor.ratingAverage, doctor.ratingCount);

    return {
      doctor: toDoctorDetail(doctor, clinics, ratingBreakdown),
      similarDoctors: similar.map(toDoctorSummary),
    };
  },

  async getDoctorQueueStatus(slug: string, clinicId: string): Promise<DoctorQueueStatus> {
    const doctor = await catalogRepository.findDoctorIdBySlug(slug);
    if (!doctor) {
      throw new NotFoundError('Doctor');
    }
    const link = await catalogRepository.findClinicDoctorLink(doctor.id, clinicId);
    if (!link) {
      throw new NotFoundError('Doctor');
    }
    return buildQueueStatus(doctor.id, clinicId);
  },

  async listSpecializations() {
    const specializations = await catalogRepository.listSpecializations();
    return specializations.map(toSpecializationSummary);
  },

  async getSpecializationBySlug(slug: string) {
    const specialization = await catalogRepository.findSpecializationBySlug(slug);
    if (!specialization) {
      throw new NotFoundError('Specialization');
    }
    return toSpecializationSummary(specialization);
  },

  async searchClinics(filters: ClinicSearchInput) {
    const { items, total } = await catalogRepository.listClinics(filters);
    return paginate(items.map(toClinicSummary), total, filters.page, filters.limit);
  },

  async getClinicBySlug(slug: string) {
    const clinic = await catalogRepository.findClinicBySlug(slug);
    if (!clinic) {
      throw new NotFoundError('Clinic');
    }
    return toClinicDetail(clinic);
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
