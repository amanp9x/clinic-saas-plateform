/** Phase 12 — Reviews, Ratings & Feedback System. */

export const REVIEW_STATUSES = ['PENDING', 'PUBLISHED', 'HIDDEN', 'REJECTED'] as const;
export type ReviewStatusValue = (typeof REVIEW_STATUSES)[number];

export const REVIEW_TYPES = ['DOCTOR', 'CLINIC'] as const;
export type ReviewEntityType = (typeof REVIEW_TYPES)[number];

/** What a patient may still do for a specific completed appointment — computed server-side from
 * appointment/consultation state and whether a review already exists for each entity type. */
export interface ReviewEligibilityDto {
  appointmentId: string;
  bookingReference: string;
  doctorId: string;
  doctorName: string;
  clinicId: string;
  clinicName: string;
  scheduledAt: string;
  canReviewDoctor: boolean;
  canReviewClinic: boolean;
  existingDoctorReviewId: string | null;
  existingClinicReviewId: string | null;
}

export interface SubmitDoctorReviewInput {
  rating: number;
  consultationExperience?: number;
  communication?: number;
  professionalism?: number;
  explanationClarity?: number;
  comment?: string;
}

export interface SubmitClinicReviewInput {
  rating: number;
  staffExperience?: number;
  cleanliness?: number;
  waitingExperience?: number;
  overallExperience?: number;
  comment?: string;
}

export interface MyReviewDto {
  id: string;
  type: ReviewEntityType;
  doctorId: string | null;
  doctorName: string | null;
  clinicId: string | null;
  clinicName: string | null;
  appointmentId: string;
  bookingReference: string | null;
  rating: number;
  consultationExperience: number | null;
  communication: number | null;
  professionalism: number | null;
  explanationClarity: number | null;
  staffExperience: number | null;
  cleanliness: number | null;
  waitingExperience: number | null;
  overallExperience: number | null;
  comment: string | null;
  status: ReviewStatusValue;
  response: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Server-computed per the edit/delete safe-policy (48h window, not yet responded to) — the
   * frontend never re-derives this itself. */
  canEdit: boolean;
  canDelete: boolean;
}

/** A row in the clinic moderation queue — combines DoctorReview (scoped via the underlying
 * appointment's clinicId) and ClinicReview (scoped directly) into one feed. Never includes
 * patientId, email, or phone — `patientName` is the same public-safe snapshot already shown on
 * the public review, not a new exposure. */
export interface ReviewModerationRowDto {
  id: string;
  type: ReviewEntityType;
  doctorId: string | null;
  doctorName: string | null;
  clinicId: string;
  patientName: string;
  appointmentId: string | null;
  rating: number;
  comment: string | null;
  status: ReviewStatusValue;
  moderationReason: string | null;
  moderatedAt: string | null;
  moderatedByUserId: string | null;
  response: string | null;
  respondedAt: string | null;
  createdAt: string;
}

