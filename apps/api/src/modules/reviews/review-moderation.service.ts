import type { UserRole } from '@clinic/shared';
import { CLINIC_PERMISSIONS, SOCKET_EVENTS } from '@clinic/shared';
import type { ModerateReviewInput, ModerationQueueQuery, ReviewModerationRowDto, PaginatedResult, ReviewResponseInput } from '@clinic/shared';
import { NotificationType } from '@prisma/client';
import { NotFoundError, ConflictError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';
import { emitToClinicRoom } from '../../sockets/emit.js';
import { notifyUser } from '../notifications/notification-dispatch.service.js';
import { assertClinicPermission } from '../reception/reception.shared.js';
import { prisma } from '../../config/database.js';
import { reviewsRepository } from './reviews.repository.js';
import { toModerationRow } from './reviews.mappers.js';
import { recomputeDoctorRating, recomputeClinicRating } from './rating-aggregate.service.js';

/** Resolves which table a review id belongs to and its authorization-relevant clinicId — never
 * trusts a client-supplied clinicId for this; DoctorReview has no direct clinicId column, so it's
 * derived from the underlying appointment. */
async function resolveReviewForModeration(reviewId: string) {
  const doctorReview = await prisma.doctorReview.findUnique({
    where: { id: reviewId },
    include: { doctor: { select: { id: true, displayName: true, userId: true } }, appointment: { select: { clinicId: true } }, patient: { select: { userId: true } } },
  });
  if (doctorReview) {
    if (!doctorReview.appointment) throw new NotFoundError('Review');
    return { kind: 'DOCTOR' as const, review: doctorReview, clinicId: doctorReview.appointment.clinicId };
  }
  const clinicReview = await prisma.clinicReview.findUnique({
    where: { id: reviewId },
    include: { patient: { select: { userId: true } } },
  });
  if (clinicReview) {
    return { kind: 'CLINIC' as const, review: clinicReview, clinicId: clinicReview.clinicId };
  }
  throw new NotFoundError('Review');
}

export const reviewModerationService = {
  async list(userId: string, role: UserRole, query: ModerationQueueQuery): Promise<PaginatedResult<ReviewModerationRowDto>> {
    await assertClinicPermission(userId, role, query.clinicId, CLINIC_PERMISSIONS.REVIEW_MODERATE);

    const { doctorRows, clinicRows } = await reviewsRepository.listModerationQueue({
      clinicId: query.clinicId,
      type: query.type,
      status: query.status,
      rating: query.rating,
      doctorId: query.doctorId,
      from: query.from ? new Date(`${query.from}T00:00:00.000Z`) : undefined,
      to: query.to ? new Date(`${query.to}T23:59:59.999Z`) : undefined,
      search: query.search,
    });

    const combined = [
      ...doctorRows.map((r) => toModerationRow({ ...r, kind: 'DOCTOR' as const })),
      ...clinicRows.map((r) => toModerationRow({ ...r, kind: 'CLINIC' as const })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = combined.length;
    const start = (query.page - 1) * query.limit;
    return { items: combined.slice(start, start + query.limit), page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) };
  },

  async getById(userId: string, role: UserRole, reviewId: string): Promise<ReviewModerationRowDto> {
    const resolved = await resolveReviewForModeration(reviewId);
    await assertClinicPermission(userId, role, resolved.clinicId, CLINIC_PERMISSIONS.REVIEW_MODERATE);
    if (resolved.kind === 'DOCTOR') {
      return toModerationRow({ ...resolved.review, kind: 'DOCTOR' });
    }
    return toModerationRow({ ...resolved.review, kind: 'CLINIC' });
  },

  async updateStatus(userId: string, role: UserRole, reviewId: string, input: ModerateReviewInput): Promise<ReviewModerationRowDto> {
    const resolved = await resolveReviewForModeration(reviewId);
    await assertClinicPermission(userId, role, resolved.clinicId, CLINIC_PERMISSIONS.REVIEW_MODERATE);

    const previousStatus = resolved.review.status;
    const wasPublished = previousStatus === 'PUBLISHED';
    const willBePublished = input.status === 'PUBLISHED';

    if (resolved.kind === 'DOCTOR') {
      const updated = await reviewsRepository.updateDoctorReview(reviewId, {
        status: input.status,
        moderationReason: input.reason || null,
        moderatedByUserId: userId,
        moderatedAt: new Date(),
      });
      if (wasPublished !== willBePublished) await recomputeDoctorRating(updated.doctorId);
      recordAuditLog({ actorUserId: userId, action: `review.status_${input.status.toLowerCase()}`, entityType: 'DoctorReview', entityId: reviewId, clinicId: resolved.clinicId, metadata: { previousStatus, reason: input.reason ?? null } });
      await notifyModeratedPatient(resolved.review.patient?.userId, previousStatus, input.status, reviewId);
      emitToClinicRoom(resolved.clinicId, SOCKET_EVENTS.REVIEW.STATUS_UPDATED, { reviewId, type: 'DOCTOR', status: input.status });
      return toModerationRow({ ...updated, doctor: resolved.review.doctor, appointment: { clinicId: resolved.clinicId }, kind: 'DOCTOR' });
    }

    const updated = await reviewsRepository.updateClinicReview(reviewId, {
      status: input.status,
      moderationReason: input.reason || null,
      moderatedByUserId: userId,
      moderatedAt: new Date(),
    });
    if (wasPublished !== willBePublished) await recomputeClinicRating(updated.clinicId);
    recordAuditLog({ actorUserId: userId, action: `review.status_${input.status.toLowerCase()}`, entityType: 'ClinicReview', entityId: reviewId, clinicId: resolved.clinicId, metadata: { previousStatus, reason: input.reason ?? null } });
    await notifyModeratedPatient(resolved.review.patient.userId, previousStatus, input.status, reviewId);
    emitToClinicRoom(resolved.clinicId, SOCKET_EVENTS.REVIEW.STATUS_UPDATED, { reviewId, type: 'CLINIC', status: input.status });
    return toModerationRow({ ...updated, kind: 'CLINIC' });
  },

  async respond(userId: string, role: UserRole, reviewId: string, input: ReviewResponseInput): Promise<ReviewModerationRowDto> {
    const resolved = await resolveReviewForModeration(reviewId);
    await assertClinicPermission(userId, role, resolved.clinicId, CLINIC_PERMISSIONS.REVIEW_MODERATE);
    if (resolved.review.response) {
      throw new ConflictError('This review already has a response');
    }

    if (resolved.kind === 'DOCTOR') {
      const updated = await reviewsRepository.updateDoctorReview(reviewId, { response: input.response, respondedAt: new Date(), respondedByUserId: userId });
      recordAuditLog({ actorUserId: userId, action: 'review.responded', entityType: 'DoctorReview', entityId: reviewId, clinicId: resolved.clinicId });
      await notifyReviewer(resolved.review.patient?.userId, reviewId);
      emitToClinicRoom(resolved.clinicId, SOCKET_EVENTS.REVIEW.RESPONSE_ADDED, { reviewId, type: 'DOCTOR' });
      return toModerationRow({ ...updated, doctor: resolved.review.doctor, appointment: { clinicId: resolved.clinicId }, kind: 'DOCTOR' });
    }

    const updated = await reviewsRepository.updateClinicReview(reviewId, { response: input.response, respondedAt: new Date(), respondedByUserId: userId });
    recordAuditLog({ actorUserId: userId, action: 'review.responded', entityType: 'ClinicReview', entityId: reviewId, clinicId: resolved.clinicId });
    await notifyReviewer(resolved.review.patient.userId, reviewId);
    emitToClinicRoom(resolved.clinicId, SOCKET_EVENTS.REVIEW.RESPONSE_ADDED, { reviewId, type: 'CLINIC' });
    return toModerationRow({ ...updated, kind: 'CLINIC' });
  },
};

async function notifyModeratedPatient(patientUserId: string | undefined, previousStatus: string, newStatus: string, reviewId: string): Promise<void> {
  if (!patientUserId) return;
  // Only transparency-worthy transitions get a notification — a review moving between PENDING
  // and PUBLISHED (the normal, expected default flow) isn't surprising news; a previously-visible
  // review being hidden/rejected is.
  const becameHidden = previousStatus === 'PUBLISHED' && (newStatus === 'HIDDEN' || newStatus === 'REJECTED');
  if (!becameHidden) return;
  // Deterministic key (no timestamp) so two concurrent moderation calls that both observe the
  // same PUBLISHED -> HIDDEN/REJECTED transition produce exactly one notification, not two — the
  // same idempotency guarantee as every other notifyUser call in this codebase. Accepted trade-off:
  // if a review is hidden, republished, then hidden again later, the second hide reuses this same
  // key and is silently deduped — a documented, minor limitation, not a correctness bug.
  await notifyUser({
    userId: patientUserId,
    type: NotificationType.REVIEW_HIDDEN,
    title: 'Your review was removed',
    message: 'A review you submitted is no longer visible on the public page.',
    relatedEntityType: 'Review',
    relatedEntityId: reviewId,
    notificationKey: `review:${reviewId}:hidden`,
  });
}

async function notifyReviewer(patientUserId: string | undefined, reviewId: string): Promise<void> {
  if (!patientUserId) return;
  await notifyUser({
    userId: patientUserId,
    type: NotificationType.REVIEW_RESPONSE,
    title: 'You received a response to your review',
    message: 'The provider has responded to your review.',
    relatedEntityType: 'Review',
    relatedEntityId: reviewId,
    notificationKey: `review:${reviewId}:response`,
  });
}
