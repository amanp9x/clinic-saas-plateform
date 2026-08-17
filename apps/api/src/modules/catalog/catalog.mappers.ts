import type {
  ArticleDto,
  ClinicAffiliation,
  ClinicDetail,
  ClinicSummary,
  DoctorDetail,
  DoctorQueueStatus,
  DoctorReviewDto,
  DoctorSummary,
  HospitalSummary,
  NextAvailable,
  PublicClinicHolidayDto,
  PublicClinicServiceDto,
  PublicClinicWorkingHoursDto,
  RatingBreakdown,
  SpecializationSummary,
  TestimonialDto,
} from '@clinic/shared';
import type {
  Article,
  ClinicHoliday,
  DoctorSession,
  Hospital,
  Specialization,
  Testimonial,
} from '@prisma/client';
import { calculateEta } from '../queue-engine/eta.service.js';
import { todayWeekday } from '../../utils/weekday.js';
import type { DoctorWithRelations, DoctorWithDetailRelations } from './catalog.repository.js';

function affiliationBase(cd: DoctorWithRelations['clinics'][number]) {
  return {
    clinicId: cd.clinic.id,
    clinicName: cd.clinic.name,
    clinicSlug: cd.clinic.slug,
    city: cd.clinic.city,
    area: cd.clinic.area,
    timings: cd.timings,
    availableDays: cd.availableDays,
    consultationTypes: cd.consultationTypes,
  };
}

const INACTIVE_QUEUE_STATUS: DoctorQueueStatus = {
  isActive: false,
  currentToken: null,
  patientsAhead: null,
  estimatedWaitMinutes: null,
  delayMinutes: null,
  delayReason: null,
};

export function toDoctorSummary(doctor: DoctorWithRelations): DoctorSummary {
  const today = todayWeekday();
  return {
    id: doctor.id,
    slug: doctor.slug,
    displayName: doctor.displayName,
    profileImageUrl: doctor.profileImageUrl,
    specializationName: doctor.specialization?.name ?? null,
    gender: doctor.gender,
    yearsExperience: doctor.yearsExperience,
    consultationFee: doctor.consultationFee ? doctor.consultationFee.toString() : null,
    onlineConsultation: doctor.onlineConsultation,
    ratingAverage: doctor.ratingAverage,
    ratingCount: doctor.ratingCount,
    languages: doctor.languages,
    city: doctor.clinics[0]?.clinic.city ?? null,
    area: doctor.clinics[0]?.clinic.area ?? null,
    availableToday: doctor.clinics.some((cd) => cd.availableDays.includes(today)),
  };
}

/** Aggregate-only, non-identifying live-queue summary. Callers must only ever pass in a
 * token-free `session` (e.g. `queueRepository.findSession`, never `findSessionWithTokens`) and a
 * pre-counted `patientsAhead`/`currentTokenNumber` — this function never touches `QueueToken.patient`. */
export function toPublicQueueSummary(
  session: DoctorSession | null,
  currentTokenNumber: number | null,
  patientsAhead: number | null,
): DoctorQueueStatus {
  if (!session) return INACTIVE_QUEUE_STATUS;

  return {
    isActive: session.queueStatus === 'ACTIVE',
    currentToken: currentTokenNumber !== null ? String(currentTokenNumber) : null,
    patientsAhead,
    estimatedWaitMinutes: calculateEta({
      patientsAhead,
      avgConsultationMinutes: session.averageConsultationMinutes,
      delayMinutes: session.delayMinutes,
      queueStatus: session.queueStatus,
      doctorStatus: session.status,
    }),
    delayMinutes: session.delayMinutes,
    delayReason: session.delayReason,
  };
}

export function toClinicAffiliation(
  cd: DoctorWithDetailRelations['clinics'][number],
  queueStatus: DoctorQueueStatus,
  nextAvailable: NextAvailable | null,
): ClinicAffiliation {
  return { ...affiliationBase(cd), queueStatus, nextAvailable };
}

export function toRatingBreakdown(
  rows: { rating: number; _count: number }[],
  average: number | null,
  count: number,
): RatingBreakdown {
  const counts = new Map<number, number>([5, 4, 3, 2, 1].map((r) => [r, 0]));
  for (const row of rows) {
    counts.set(row.rating, row._count);
  }
  return {
    average,
    count,
    distribution: [5, 4, 3, 2, 1].map((rating) => ({
      rating: rating as 1 | 2 | 3 | 4 | 5,
      count: counts.get(rating) ?? 0,
    })),
  };
}

export function toDoctorDetail(
  doctor: DoctorWithDetailRelations,
  clinics: ClinicAffiliation[],
  ratingBreakdown: RatingBreakdown,
): DoctorDetail {
  const reviews: DoctorReviewDto[] = doctor.reviews.map((r) => ({
    id: r.id,
    authorName: r.authorName,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt.toISOString(),
    response: r.response,
    respondedAt: r.respondedAt ? r.respondedAt.toISOString() : null,
  }));

  return {
    ...toDoctorSummary(doctor),
    qualifications: doctor.qualifications,
    bio: doctor.bio,
    clinics,
    reviews,
    ratingBreakdown,
    queueStatus: clinics.find((c) => c.queueStatus.isActive)?.queueStatus ?? INACTIVE_QUEUE_STATUS,
  };
}

export function toSpecializationSummary(
  spec: Specialization & { _count: { doctors: number } },
): SpecializationSummary {
  return {
    id: spec.id,
    name: spec.name,
    slug: spec.slug,
    iconName: spec.iconName,
    description: spec.description,
    doctorCount: spec._count.doctors,
  };
}

function toClinicSummaryBase(
  clinic: { id: string; slug: string; name: string; city: string | null; area: string | null; state: string | null; addressLine1: string | null; phone: string | null; description: string | null; photoUrl: string | null; ratingAverage: number | null; ratingCount: number },
  doctorCount: number,
): ClinicSummary {
  return {
    id: clinic.id,
    slug: clinic.slug,
    name: clinic.name,
    city: clinic.city,
    area: clinic.area,
    state: clinic.state,
    addressLine1: clinic.addressLine1,
    phone: clinic.phone,
    description: clinic.description,
    photoUrl: clinic.photoUrl,
    doctorCount,
    ratingAverage: clinic.ratingAverage,
    ratingCount: clinic.ratingCount,
  };
}

export function toClinicSummary(clinic: Parameters<typeof toClinicSummaryBase>[0] & { _count: { doctors: number } }): ClinicSummary {
  return toClinicSummaryBase(clinic, clinic._count.doctors);
}

function formatTime(t: Date): string {
  return t.toISOString().slice(11, 16);
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface ClinicWithDetailRelations {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  area: string | null;
  state: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  phone: string | null;
  description: string | null;
  photoUrl: string | null;
  website: string | null;
  languages: string[];
  facilities: string[];
  latitude: number | null;
  longitude: number | null;
  status: string;
  ratingAverage: number | null;
  ratingCount: number;
  doctors: { doctor: DoctorWithRelations }[];
  workingHours: { weekday: string; isOpen: boolean; sessions: { startTime: Date; endTime: Date }[] }[];
  holidays: ClinicHoliday[];
  services: { id: string; name: string; durationMinutes: number; price: { toString(): string }; department: { name: string } | null }[];
  reviews: { id: string; authorName: string; rating: number; comment: string | null; createdAt: Date; response: string | null; respondedAt: Date | null }[];
  _count: { doctors: number };
}

export function toClinicDetail(clinic: ClinicWithDetailRelations, ratingBreakdown: RatingBreakdown): ClinicDetail {
  return {
    ...toClinicSummaryBase(clinic, clinic._count.doctors),
    addressLine2: clinic.addressLine2,
    postalCode: clinic.postalCode,
    latitude: clinic.latitude,
    longitude: clinic.longitude,
    website: clinic.website,
    languages: clinic.languages,
    facilities: clinic.facilities,
    status: clinic.status,
    workingHours: clinic.workingHours.map((wh) => ({
      weekday: wh.weekday,
      isOpen: wh.isOpen,
      sessions: wh.sessions.map((s) => ({ startTime: formatTime(s.startTime), endTime: formatTime(s.endTime) })),
    })) as PublicClinicWorkingHoursDto[],
    holidays: clinic.holidays.map((h) => ({ date: formatDate(h.date), name: h.name })) as PublicClinicHolidayDto[],
    services: clinic.services.map((s) => ({
      id: s.id,
      name: s.name,
      durationMinutes: s.durationMinutes,
      price: s.price.toString(),
      departmentName: s.department?.name ?? null,
    })) as PublicClinicServiceDto[],
    doctors: clinic.doctors.map((cd) => toDoctorSummary(cd.doctor)),
    reviews: clinic.reviews.map((r) => ({
      id: r.id,
      authorName: r.authorName,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
      response: r.response,
      respondedAt: r.respondedAt ? r.respondedAt.toISOString() : null,
    })),
    ratingBreakdown,
  };
}

export function toHospitalSummary(hospital: Hospital): HospitalSummary {
  return {
    id: hospital.id,
    slug: hospital.slug,
    name: hospital.name,
    city: hospital.city,
    state: hospital.state,
    addressLine1: hospital.addressLine1,
    phone: hospital.phone,
    description: hospital.description,
    photoUrl: hospital.photoUrl,
    bedCount: hospital.bedCount,
  };
}

export function toTestimonialDto(t: Testimonial): TestimonialDto {
  return {
    id: t.id,
    authorName: t.authorName,
    authorDetail: t.authorDetail,
    message: t.message,
    rating: t.rating,
    avatarUrl: t.avatarUrl,
  };
}

export function toArticleDto(a: Article): ArticleDto {
  return {
    id: a.id,
    title: a.title,
    slug: a.slug,
    excerpt: a.excerpt,
    coverImageUrl: a.coverImageUrl,
    category: a.category,
    authorName: a.authorName,
    publishedAt: a.publishedAt.toISOString(),
  };
}
