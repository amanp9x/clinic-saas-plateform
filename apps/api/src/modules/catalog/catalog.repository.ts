import type { Prisma } from '@prisma/client';
import type { DoctorSearchInput, ClinicSearchInput, HospitalSearchInput } from '@clinic/shared';
import { prisma } from '../../config/database.js';
import { startOfDay, startOfWeek } from '../../utils/date.js';
import { todayWeekday } from '../../utils/weekday.js';
import { queueRepository } from '../doctor-queue/queue.repository.js';

export const doctorCardInclude = {
  specialization: true,
  clinics: {
    where: { isActive: true },
    include: { clinic: true },
  },
} satisfies Prisma.DoctorInclude;

export type DoctorWithRelations = Prisma.DoctorGetPayload<{ include: typeof doctorCardInclude }>;

const doctorDetailInclude = {
  specialization: true,
  clinics: {
    where: { isActive: true },
    include: {
      clinic: { include: { holidays: { where: { date: { gte: startOfDay() } } } } },
      availability: { where: { isActive: true } },
    },
  },
  // PUBLISHED only — Phase 12 added moderation, and this is a public-facing endpoint. Legacy rows
  // (seeded before Phase 12, no explicit status set) default to PUBLISHED via the schema default,
  // so they keep showing up unchanged.
  reviews: { where: { status: 'PUBLISHED' }, orderBy: { createdAt: 'desc' }, take: 20 },
  leaves: { where: { endDate: { gte: startOfDay() } } },
} satisfies Prisma.DoctorInclude;

export type DoctorWithDetailRelations = Prisma.DoctorGetPayload<{ include: typeof doctorDetailInclude }>;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function buildDoctorWhere(filters: DoctorSearchInput): Prisma.DoctorWhereInput {
  const where: Prisma.DoctorWhereInput = { isActive: true };

  if (filters.query) {
    where.OR = [
      { displayName: { contains: filters.query, mode: 'insensitive' } },
      { specialization: { name: { contains: filters.query, mode: 'insensitive' } } },
      { clinics: { some: { isActive: true, clinic: { name: { contains: filters.query, mode: 'insensitive' } } } } },
    ];
  }
  if (filters.specializationSlug) {
    where.specialization = { slug: filters.specializationSlug };
  }
  if (filters.gender) {
    where.gender = filters.gender;
  }
  if (filters.minExperience !== undefined) {
    where.yearsExperience = { gte: filters.minExperience };
  }
  if (filters.maxFee !== undefined) {
    where.consultationFee = { lte: filters.maxFee };
  }
  if (filters.minRating !== undefined) {
    where.ratingAverage = { gte: filters.minRating };
  }
  if (filters.onlineConsultation) {
    where.onlineConsultation = true;
  }
  if (filters.languages && filters.languages.length > 0) {
    where.languages = { hasSome: filters.languages };
  }

  const clinicConditions: Prisma.ClinicDoctorWhereInput = { isActive: true };
  let hasClinicCondition = false;
  const nestedClinicWhere: Prisma.ClinicWhereInput = {};
  if (filters.city) {
    nestedClinicWhere.city = { equals: filters.city, mode: 'insensitive' };
    hasClinicCondition = true;
  }
  if (filters.area) {
    nestedClinicWhere.area = { equals: filters.area, mode: 'insensitive' };
    hasClinicCondition = true;
  }
  if (Object.keys(nestedClinicWhere).length > 0) {
    clinicConditions.clinic = nestedClinicWhere;
  }
  if (filters.clinicId) {
    clinicConditions.clinicId = filters.clinicId;
    hasClinicCondition = true;
  }
  if (filters.consultationType) {
    clinicConditions.consultationTypes = { has: filters.consultationType };
    hasClinicCondition = true;
  }
  if (filters.availableToday) {
    clinicConditions.availableDays = { has: todayWeekday() };
    hasClinicCondition = true;
  } else if (filters.availableThisWeek) {
    // Day-level, coarse approximation: has a weekly template at all. Combined below with a
    // whole-week leave exclusion. Doesn't check per-day precision or holidays — consistent with
    // the day-level-only scope for availability throughout this module.
    clinicConditions.availableDays = { isEmpty: false };
    hasClinicCondition = true;
  }
  if (hasClinicCondition) {
    where.clinics = { some: clinicConditions };
  }

  if (filters.availableThisWeek) {
    const weekStart = startOfWeek();
    const weekEnd = addDays(weekStart, 6);
    where.leaves = {
      none: { startDate: { lte: weekStart }, endDate: { gte: weekEnd } },
    };
  }

  return where;
}

function doctorOrderBy(sort: DoctorSearchInput['sort']): Prisma.DoctorOrderByWithRelationInput | undefined {
  switch (sort) {
    case 'rating':
      return { ratingAverage: 'desc' };
    case 'experience':
      return { yearsExperience: 'desc' };
    case 'fee_low':
      return { consultationFee: 'asc' };
    case 'fee_high':
      return { consultationFee: 'desc' };
    case 'most_reviewed':
      return { ratingCount: 'desc' };
    case 'availability':
      // Next-available date isn't a DB column — the page is fetched unordered here and
      // stable-sorted by computed nextAvailable in catalogService.searchDoctors instead.
      return undefined;
    case 'relevance':
    default:
      return { ratingCount: 'desc' };
  }
}

export const catalogRepository = {
  async listDoctors(filters: DoctorSearchInput) {
    const where = buildDoctorWhere(filters);
    const [items, total] = await Promise.all([
      prisma.doctor.findMany({
        where,
        include: doctorCardInclude,
        orderBy: doctorOrderBy(filters.sort),
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.doctor.count({ where }),
    ]);
    return { items, total };
  },

  findDoctorBySlug(slug: string) {
    return prisma.doctor.findFirst({
      where: { slug, isActive: true },
      include: doctorDetailInclude,
    });
  },

  findDoctorIdBySlug(slug: string) {
    return prisma.doctor.findFirst({ where: { slug, isActive: true }, select: { id: true } });
  },

  findClinicIdBySlug(slug: string) {
    return prisma.clinic.findFirst({ where: { slug, isActive: true }, select: { id: true } });
  },

  findClinicDoctorLink(doctorId: string, clinicId: string) {
    return prisma.clinicDoctor.findFirst({
      where: { doctorId, clinicId, isActive: true, queueEnabled: true },
      select: { id: true },
    });
  },

  groupDoctorReviewRatings(doctorId: string) {
    return prisma.doctorReview.groupBy({ by: ['rating'], where: { doctorId, status: 'PUBLISHED' }, _count: true });
  },

  groupClinicReviewRatings(clinicId: string) {
    return prisma.clinicReview.groupBy({ by: ['rating'], where: { clinicId, status: 'PUBLISHED' }, _count: true });
  },

  getCurrentTokenNumber(tokenId: string) {
    return prisma.queueToken.findUnique({ where: { id: tokenId }, select: { tokenNumber: true } });
  },

  findTodaySession(doctorId: string, clinicId: string) {
    return queueRepository.findSession(doctorId, clinicId);
  },

  countWaitingTokens(sessionId: string) {
    return queueRepository.countByStatus(sessionId, 'WAITING');
  },

  /** Bulk fetch for `sort=availability` — one query for the whole result page instead of an
   * N+1 per doctor. */
  listAvailabilityContext(doctorIds: string[]) {
    return prisma.clinicDoctor.findMany({
      where: { doctorId: { in: doctorIds }, isActive: true },
      select: {
        doctorId: true,
        clinicId: true,
        availability: {
          where: { isActive: true },
          select: { weekday: true, startTime: true, endTime: true },
        },
        clinic: {
          select: {
            holidays: {
              where: { date: { gte: startOfDay() } },
              select: { date: true, isFullDay: true },
            },
          },
        },
      },
    });
  },

  listLeavesForDoctors(doctorIds: string[]) {
    return prisma.doctorLeave.findMany({
      where: { doctorId: { in: doctorIds }, endDate: { gte: startOfDay() } },
      select: { doctorId: true, clinicId: true, startDate: true, endDate: true },
    });
  },

  listSimilarDoctors(specializationId: string | null, excludeDoctorId: string, take = 4) {
    if (!specializationId) return Promise.resolve([]);
    return prisma.doctor.findMany({
      where: { specializationId, isActive: true, id: { not: excludeDoctorId } },
      include: doctorCardInclude,
      orderBy: { ratingAverage: 'desc' },
      take,
    });
  },

  listSpecializations() {
    return prisma.specialization.findMany({
      where: { isActive: true },
      include: { _count: { select: { doctors: { where: { isActive: true } } } } },
      orderBy: { name: 'asc' },
    });
  },

  findSpecializationBySlug(slug: string) {
    return prisma.specialization.findFirst({
      where: { slug, isActive: true },
      include: { _count: { select: { doctors: { where: { isActive: true } } } } },
    });
  },

  async listClinics(filters: ClinicSearchInput) {
    const where: Prisma.ClinicWhereInput = {
      isActive: true,
      ...(filters.city ? { city: { equals: filters.city, mode: 'insensitive' } } : {}),
      ...(filters.area ? { area: { equals: filters.area, mode: 'insensitive' } } : {}),
      ...(filters.query ? { name: { contains: filters.query, mode: 'insensitive' } } : {}),
    };

    // "Rating" and fee/consultation-type/service/availability filters are all expressed as "this
    // clinic has at least one doctor/service matching X" — there is no denormalized clinic-level
    // rating column (and no raw-SQL usage elsewhere in this codebase to justify adding a synced
    // one), so `minRating` deliberately means "has a doctor rated >= X", not a clinic aggregate.
    const doctorConditions: Prisma.ClinicDoctorWhereInput = { isActive: true };
    let hasDoctorCondition = false;
    const nestedDoctorWhere: Prisma.DoctorWhereInput = {};
    if (filters.minRating !== undefined) {
      nestedDoctorWhere.ratingAverage = { gte: filters.minRating };
      hasDoctorCondition = true;
    }
    if (filters.maxFee !== undefined) {
      nestedDoctorWhere.consultationFee = { lte: filters.maxFee };
      hasDoctorCondition = true;
    }
    if (Object.keys(nestedDoctorWhere).length > 0) {
      doctorConditions.doctor = nestedDoctorWhere;
    }
    if (filters.consultationType) {
      doctorConditions.consultationTypes = { has: filters.consultationType };
      hasDoctorCondition = true;
    }
    if (filters.availableToday) {
      doctorConditions.availableDays = { has: todayWeekday() };
      hasDoctorCondition = true;
    }
    if (hasDoctorCondition) {
      where.doctors = { some: doctorConditions };
    }
    if (filters.service) {
      where.services = { some: { isActive: true, name: { contains: filters.service, mode: 'insensitive' } } };
    }

    const [items, total] = await Promise.all([
      prisma.clinic.findMany({
        where,
        include: { _count: { select: { doctors: { where: { isActive: true } } } } },
        orderBy: { name: 'asc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.clinic.count({ where }),
    ]);
    return { items, total };
  },

  findClinicBySlug(slug: string) {
    return prisma.clinic.findFirst({
      where: { slug, isActive: true },
      include: {
        doctors: {
          where: { isActive: true },
          include: { doctor: { include: doctorCardInclude } },
        },
        workingHours: { include: { sessions: true }, orderBy: { weekday: 'asc' } },
        holidays: { where: { date: { gte: startOfDay() } }, orderBy: { date: 'asc' }, take: 10 },
        services: { where: { isActive: true }, include: { department: true } },
        reviews: { where: { status: 'PUBLISHED' }, orderBy: { createdAt: 'desc' }, take: 20 },
        _count: { select: { doctors: { where: { isActive: true } } } },
      },
    });
  },

  async listHospitals(filters: HospitalSearchInput) {
    const where: Prisma.HospitalWhereInput = {
      isActive: true,
      ...(filters.city ? { city: { equals: filters.city, mode: 'insensitive' } } : {}),
      ...(filters.query ? { name: { contains: filters.query, mode: 'insensitive' } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.hospital.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.hospital.count({ where }),
    ]);
    return { items, total };
  },

  listTestimonials(limit: number) {
    return prisma.testimonial.findMany({
      where: { isFeatured: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  listArticles(limit: number) {
    return prisma.article.findMany({
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });
  },

  distinctCities() {
    return prisma.clinic.findMany({
      where: { isActive: true, city: { not: null } },
      distinct: ['city'],
      select: { city: true },
      orderBy: { city: 'asc' },
    });
  },
};
