import type { ConsultationType, Gender } from '../enums.js';

export interface SpecializationSummary {
  id: string;
  name: string;
  slug: string;
  iconName: string | null;
  description: string | null;
  doctorCount: number;
}

/** Next date/time-window a doctor has a scheduled session at a clinic. Day-level only — derived
 * from the weekly availability template + leaves + holidays, not a reserved/bookable timeslot. */
export interface NextAvailable {
  date: string;
  weekday: string;
  startTime: string;
  endTime: string;
}

export interface RatingBreakdown {
  average: number | null;
  count: number;
  distribution: { rating: 1 | 2 | 3 | 4 | 5; count: number }[];
}

export interface ClinicAffiliation {
  clinicId: string;
  clinicName: string;
  clinicSlug: string;
  city: string | null;
  area: string | null;
  timings: string | null;
  availableDays: string[];
  consultationTypes: ConsultationType[];
  queueStatus: DoctorQueueStatus;
  nextAvailable: NextAvailable | null;
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
  area: string | null;
  availableToday: boolean;
}

export interface DoctorReviewDto {
  id: string;
  authorName: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  response: string | null;
  respondedAt: string | null;
}

export interface ClinicReviewDto {
  id: string;
  authorName: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  response: string | null;
  respondedAt: string | null;
}

/** Aggregate-only, non-identifying live-queue summary — never contains patient names/ids/phones.
 * `isActive: false` with all other fields null is the honest "no session running" state. */
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
  ratingBreakdown: RatingBreakdown;
  /** The first clinic affiliation currently active, or the honest inactive stub if none are. */
  queueStatus: DoctorQueueStatus;
}

export interface ClinicSummary {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  area: string | null;
  state: string | null;
  addressLine1: string | null;
  phone: string | null;
  description: string | null;
  photoUrl: string | null;
  doctorCount: number;
  ratingAverage: number | null;
  ratingCount: number;
}

export interface PublicClinicWorkingHoursDto {
  weekday: string;
  isOpen: boolean;
  sessions: { startTime: string; endTime: string }[];
}

export interface PublicClinicHolidayDto {
  date: string;
  name: string;
}

export interface PublicClinicServiceDto {
  id: string;
  name: string;
  durationMinutes: number;
  price: string;
  departmentName: string | null;
}

export interface ClinicDetail extends ClinicSummary {
  addressLine2: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  website: string | null;
  languages: string[];
  facilities: string[];
  status: string;
  workingHours: PublicClinicWorkingHoursDto[];
  holidays: PublicClinicHolidayDto[];
  services: PublicClinicServiceDto[];
  doctors: DoctorSummary[];
  reviews: ClinicReviewDto[];
  ratingBreakdown: RatingBreakdown;
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
