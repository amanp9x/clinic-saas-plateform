import type { Gender } from '../enums.js';

export interface SpecializationSummary {
  id: string;
  name: string;
  slug: string;
  iconName: string | null;
  description: string | null;
  doctorCount: number;
}

export interface ClinicAffiliation {
  clinicId: string;
  clinicName: string;
  clinicSlug: string;
  city: string | null;
  timings: string | null;
  availableDays: string[];
}

export interface DoctorSummary {
  id: string;
  slug: string;
  displayName: string;
  profileImageUrl: string | null;
  specializationName: string | null;
  gender: Gender | null;
  yearsExperience: number | null;
  consultationFee: string | null;
  onlineConsultation: boolean;
  ratingAverage: number | null;
  ratingCount: number;
  languages: string[];
  city: string | null;
  availableToday: boolean;
}

export interface DoctorReviewDto {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

/** Honest, currently-static representation of live-queue state. No queue module exists yet, so
 * this is always `{ isActive: false }` until the (future) live-queue phase starts populating it. */
export interface DoctorQueueStatus {
  isActive: boolean;
  currentToken: string | null;
  patientsAhead: number | null;
  estimatedWaitMinutes: number | null;
  delayMinutes: number | null;
  delayReason: string | null;
}

export interface DoctorDetail extends DoctorSummary {
  qualifications: string | null;
  bio: string | null;
  clinics: ClinicAffiliation[];
  reviews: DoctorReviewDto[];
  queueStatus: DoctorQueueStatus;
}

export interface ClinicSummary {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  state: string | null;
  addressLine1: string | null;
  phone: string | null;
  description: string | null;
  photoUrl: string | null;
  doctorCount: number;
}

export interface HospitalSummary {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  state: string | null;
  addressLine1: string | null;
  phone: string | null;
  description: string | null;
  photoUrl: string | null;
  bedCount: number | null;
}

export interface TestimonialDto {
  id: string;
  authorName: string;
  authorDetail: string | null;
  message: string;
  rating: number | null;
  avatarUrl: string | null;
}

export interface ArticleDto {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImageUrl: string | null;
  category: string | null;
  authorName: string | null;
  publishedAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
