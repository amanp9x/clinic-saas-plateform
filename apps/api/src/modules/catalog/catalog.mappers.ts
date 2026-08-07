import type {
  ArticleDto,
  ClinicAffiliation,
  ClinicSummary,
  DoctorDetail,
  DoctorReviewDto,
  DoctorSummary,
  HospitalSummary,
  SpecializationSummary,
  TestimonialDto,
} from '@clinic/shared';
import type { Article, Clinic, Hospital, Specialization, Testimonial } from '@prisma/client';
import { todayWeekday } from '../../utils/weekday.js';
import type { DoctorWithRelations } from './catalog.repository.js';

function affiliations(doctor: DoctorWithRelations): ClinicAffiliation[] {
  return doctor.clinics.map((cd) => ({
    clinicId: cd.clinic.id,
    clinicName: cd.clinic.name,
    clinicSlug: cd.clinic.slug,
    city: cd.clinic.city,
    timings: cd.timings,
    availableDays: cd.availableDays,
  }));
}

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
    availableToday: doctor.clinics.some((cd) => cd.availableDays.includes(today)),
  };
}

export function toDoctorDetail(
  doctor: DoctorWithRelations & {
    reviews: { id: string; authorName: string; rating: number; comment: string; createdAt: Date }[];
  },
): DoctorDetail {
  const reviews: DoctorReviewDto[] = doctor.reviews.map((r) => ({
    id: r.id,
    authorName: r.authorName,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt.toISOString(),
  }));

  return {
    ...toDoctorSummary(doctor),
    qualifications: doctor.qualifications,
    bio: doctor.bio,
    clinics: affiliations(doctor),
    reviews,
    // No live-queue module exists yet — this is an honest "not active" state, not a fabricated one.
    queueStatus: {
      isActive: false,
      currentToken: null,
      patientsAhead: null,
      estimatedWaitMinutes: null,
      delayMinutes: null,
      delayReason: null,
    },
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

export function toClinicSummary(clinic: Clinic & { _count: { doctors: number } }): ClinicSummary {
  return {
    id: clinic.id,
    slug: clinic.slug,
    name: clinic.name,
    city: clinic.city,
    state: clinic.state,
    addressLine1: clinic.addressLine1,
    phone: clinic.phone,
    description: clinic.description,
    photoUrl: clinic.photoUrl,
    doctorCount: clinic._count.doctors,
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
