import type { DoctorReview, ClinicReview } from '@prisma/client';
import type { MyReviewDto, ReviewModerationRowDto, DoctorReviewDto, ClinicReviewDto } from '@clinic/shared';

/** Patient may edit/delete their own review within 48h of submission, and only while no provider
 * response exists yet — editing/deleting after a response would silently invalidate the context
 * the provider responded to. This is the one place the policy is decided; every caller (mapper,
 * service) goes through it so the rule can never drift between "what the API allows" and "what
 * the UI shows as available." */
const EDIT_WINDOW_MS = 48 * 60 * 60 * 1000;

export function canEditOrDeleteReview(review: { createdAt: Date; response: string | null }): boolean {
  return review.response === null && Date.now() - review.createdAt.getTime() <= EDIT_WINDOW_MS;
}

export function toMyDoctorReviewDto(review: DoctorReview & { doctor: { id: string; displayName: string }; appointment: { bookingReference: string } | null }): MyReviewDto {
  const editable = canEditOrDeleteReview(review);
  return {
    id: review.id,
    type: 'DOCTOR',
    doctorId: review.doctor.id,
    doctorName: review.doctor.displayName,
    clinicId: null,
    clinicName: null,
    appointmentId: review.appointmentId ?? '',
    bookingReference: review.appointment?.bookingReference ?? null,
    rating: review.rating,
    consultationExperience: review.consultationExperience,
    communication: review.communication,
    professionalism: review.professionalism,
    explanationClarity: review.explanationClarity,
    staffExperience: null,
    cleanliness: null,
    waitingExperience: null,
    overallExperience: null,
    comment: review.comment,
    status: review.status,
    response: review.response,
    respondedAt: review.respondedAt ? review.respondedAt.toISOString() : null,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    canEdit: editable,
    canDelete: editable,
  };
}

export function toMyClinicReviewDto(review: ClinicReview & { clinic: { id: string; name: string }; appointment: { bookingReference: string } }): MyReviewDto {
  const editable = canEditOrDeleteReview(review);
  return {
    id: review.id,
    type: 'CLINIC',
    doctorId: null,
    doctorName: null,
    clinicId: review.clinic.id,
    clinicName: review.clinic.name,
    appointmentId: review.appointmentId,
    bookingReference: review.appointment.bookingReference,
    rating: review.rating,
    consultationExperience: null,
    communication: null,
    professionalism: null,
    explanationClarity: null,
    staffExperience: review.staffExperience,
    cleanliness: review.cleanliness,
    waitingExperience: review.waitingExperience,
    overallExperience: review.overallExperience,
    comment: review.comment,
    status: review.status,
    response: review.response,
    respondedAt: review.respondedAt ? review.respondedAt.toISOString() : null,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    canEdit: editable,
    canDelete: editable,
  };
}

export function toPublicDoctorReviewDto(review: DoctorReview): DoctorReviewDto {
  return {
    id: review.id,
    authorName: review.authorName,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt.toISOString(),
    response: review.response,
    respondedAt: review.respondedAt ? review.respondedAt.toISOString() : null,
  };
}

export function toPublicClinicReviewDto(review: ClinicReview): ClinicReviewDto {
  return {
    id: review.id,
    authorName: review.authorName,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt.toISOString(),
    response: review.response,
    respondedAt: review.respondedAt ? review.respondedAt.toISOString() : null,
  };
}

export function toModerationRow(
  review:
    | (DoctorReview & { doctor: { id: string; displayName: string }; appointment: { clinicId: string } | null; kind: 'DOCTOR' })
    | (ClinicReview & { kind: 'CLINIC' }),
): ReviewModerationRowDto {
  if (review.kind === 'DOCTOR') {
    return {
      id: review.id,
      type: 'DOCTOR',
      doctorId: review.doctor.id,
      doctorName: review.doctor.displayName,
      clinicId: review.appointment?.clinicId ?? '',
      patientName: review.authorName,
      appointmentId: review.appointmentId,
      rating: review.rating,
      comment: review.comment,
      status: review.status,
      moderationReason: review.moderationReason,
      moderatedAt: review.moderatedAt ? review.moderatedAt.toISOString() : null,
      moderatedByUserId: review.moderatedByUserId,
      response: review.response,
      respondedAt: review.respondedAt ? review.respondedAt.toISOString() : null,
      createdAt: review.createdAt.toISOString(),
    };
  }
  return {
    id: review.id,
    type: 'CLINIC',
    doctorId: null,
    doctorName: null,
    clinicId: review.clinicId,
    patientName: review.authorName,
    appointmentId: review.appointmentId,
    rating: review.rating,
    comment: review.comment,
    status: review.status,
    moderationReason: review.moderationReason,
    moderatedAt: review.moderatedAt ? review.moderatedAt.toISOString() : null,
    moderatedByUserId: review.moderatedByUserId,
    response: review.response,
    respondedAt: review.respondedAt ? review.respondedAt.toISOString() : null,
    createdAt: review.createdAt.toISOString(),
  };
}
