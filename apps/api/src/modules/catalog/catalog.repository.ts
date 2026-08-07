import type { Prisma } from '@prisma/client';
import type { DoctorSearchInput, ClinicSearchInput, HospitalSearchInput } from '@clinic/shared';
import { prisma } from '../../config/database.js';
import { todayWeekday } from '../../utils/weekday.js';

const doctorCardInclude = {
  specialization: true,
  clinics: {
    where: { isActive: true },
    include: { clinic: true },
  },
} satisfies Prisma.DoctorInclude;

export type DoctorWithRelations = Prisma.DoctorGetPayload<{ include: typeof doctorCardInclude }>;

function buildDoctorWhere(filters: DoctorSearchInput): Prisma.DoctorWhereInput {
  const where: Prisma.DoctorWhereInput = { isActive: true };

  if (filters.query) {
    where.OR = [
      { displayName: { contains: filters.query, mode: 'insensitive' } },
      { specialization: { name: { contains: filters.query, mode: 'insensitive' } } },
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
  if (filters.city || filters.availableToday) {
    where.clinics = {
      some: {
        isActive: true,
        ...(filters.city
          ? { clinic: { city: { equals: filters.city, mode: 'insensitive' } } }
          : {}),
        ...(filters.availableToday ? { availableDays: { has: todayWeekday() } } : {}),
      },
    };
  }

  return where;
}

function doctorOrderBy(sort: DoctorSearchInput['sort']): Prisma.DoctorOrderByWithRelationInput {
  switch (sort) {
    case 'rating':
      return { ratingAverage: 'desc' };
    case 'experience':
      return { yearsExperience: 'desc' };
    case 'fee_low':
      return { consultationFee: 'asc' };
    case 'fee_high':
      return { consultationFee: 'desc' };
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
      include: {
        specialization: true,
        clinics: { where: { isActive: true }, include: { clinic: true } },
        reviews: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
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

  async listClinics(filters: ClinicSearchInput) {
    const where: Prisma.ClinicWhereInput = {
      isActive: true,
      ...(filters.city ? { city: { equals: filters.city, mode: 'insensitive' } } : {}),
      ...(filters.query ? { name: { contains: filters.query, mode: 'insensitive' } } : {}),
    };

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
