import type { CreateReviewInput, UpdateReviewInput } from '@clinic/shared';
import type { MyReviewDto, PaginatedResult, ReviewEligibilityDto } from '@clinic/shared';
import { SOCKET_EVENTS } from '@clinic/shared';
import { NotificationType } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';
import { emitToClinicRoom } from '../../sockets/emit.js';
import { notifyUser } from '../notifications/notification-dispatch.service.js';
import { isUniqueConstraintError } from '../doctor-queue/queue.repository.js';
import { patientRepository } from '../patient/patient.repository.js';
import { reviewsRepository } from './reviews.repository.js';
import { resolveOwnedAppointment, assertAppointmentReviewable, toEligibilityDto } from './review-eligibility.service.js';
import { recomputeDoctorRating, recomputeClinicRating } from './rating-aggregate.service.js';
import { toMyDoctorReviewDto, toMyClinicReviewDto, canEditOrDeleteReview } from './reviews.mappers.js';

export const reviewsService = {
  async checkEligibility(userId: string, appointmentId: string): Promise<ReviewEligibilityDto> {
    const appointment = await resolveOwnedAppointment(userId, appointmentId);
    return toEligibilityDto(appointment);
  },

  async create(userId: string, input: CreateReviewInput): Promise<MyReviewDto[]> {
    const appointment = await resolveOwnedAppointment(userId, input.appointmentId);
    assertAppointmentReviewable(appointment);

    const authorName = appointment.patient.fullName;
    const results: MyReviewDto[] = [];

    if (input.doctorReview) {
      if (appointment.doctorReview) {
        throw new ConflictError('You have already reviewed this doctor for this appointment');
      }
      let created;
      try {
        created = await reviewsRepository.createDoctorReview({
          doctorId: appointment.doctorId,
          patientId: appointment.patientId,
          appointmentId: appointment.id,
          authorName,
          rating: input.doctorReview.rating,
          consultationExperience: input.doctorReview.consultationExperience,
          communication: input.doctorReview.communication,
          professionalism: input.doctorReview.professionalism,
          explanationClarity: input.doctorReview.explanationClarity,
          comment: input.doctorReview.comment || null,
        });
      } catch (err) {
        // Concurrency guard — the appointmentId unique constraint is what makes "two simultaneous
        // submissions for the same appointment" produce exactly one row at the database level,
        // not just an application-level pre-check that a race could slip past.
        if (isUniqueConstraintError(err)) {
          throw new ConflictError('You have already reviewed this doctor for this appointment');
        }
        throw err;
      }

      await recomputeDoctorRating(appointment.doctorId);
      recordAuditLog({ actorUserId: userId, action: 'review.submitted', entityType: 'DoctorReview', entityId: created.id, clinicId: appointment.clinicId, metadata: { doctorId: appointment.doctorId } });
      await notifyUser({
        userId: appointment.doctor.userId,
        type: NotificationType.REVIEW_RECEIVED,
        title: 'New review received',
        message: `You received a new ${created.rating}-star review.`,
        relatedEntityType: 'DoctorReview',
        relatedEntityId: created.id,
        notificationKey: `review:doctor:${created.id}:received`,
      });
      emitToClinicRoom(appointment.clinicId, SOCKET_EVENTS.REVIEW.CREATED, { reviewId: created.id, type: 'DOCTOR', doctorId: appointment.doctorId });

      results.push(toMyDoctorReviewDto({ ...created, doctor: { id: appointment.doctorId, displayName: appointment.doctor.displayName }, appointment: { bookingReference: appointment.bookingReference } }));
    }

    if (input.clinicReview) {
      if (appointment.clinicReview) {
        throw new ConflictError('You have already reviewed this clinic for this appointment');
      }
      let created;
      try {
        created = await reviewsRepository.createClinicReview({
          clinicId: appointment.clinicId,
          patientId: appointment.patientId,
          appointmentId: appointment.id,
          authorName,
          rating: input.clinicReview.rating,
          staffExperience: input.clinicReview.staffExperience,
          cleanliness: input.clinicReview.cleanliness,
          waitingExperience: input.clinicReview.waitingExperience,
          overallExperience: input.clinicReview.overallExperience,
          comment: input.clinicReview.comment || null,
        });
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          throw new ConflictError('You have already reviewed this clinic for this appointment');
        }
        throw err;
      }

      await recomputeClinicRating(appointment.clinicId);
      recordAuditLog({ actorUserId: userId, action: 'review.submitted', entityType: 'ClinicReview', entityId: created.id, clinicId: appointment.clinicId });
      emitToClinicRoom(appointment.clinicId, SOCKET_EVENTS.REVIEW.CREATED, { reviewId: created.id, type: 'CLINIC', clinicId: appointment.clinicId });

      results.push(toMyClinicReviewDto({ ...created, clinic: { id: appointment.clinicId, name: appointment.clinic.name }, appointment: { bookingReference: appointment.bookingReference } }));
    }

    return results;
  },

  async listMy(userId: string, query: { type?: 'DOCTOR' | 'CLINIC'; page: number; limit: number }): Promise<PaginatedResult<MyReviewDto>> {
    const patient = await patientRepository.findByUserIdOrThrow(userId);

    if (query.type === 'DOCTOR') {
      const { total, items } = await reviewsRepository.listMyDoctorReviews(patient.id, query.page, query.limit);
      return { items: items.map(toMyDoctorReviewDto), page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) };
    }
    if (query.type === 'CLINIC') {
      const { total, items } = await reviewsRepository.listMyClinicReviews(patient.id, query.page, query.limit);
      return { items: items.map(toMyClinicReviewDto), page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) };
    }

    // No type filter — merge both, sorted by createdAt desc, then paginate the combined list.
    // A patient's own review count is bounded (their own appointment history), so merging in
    // memory here is not the "avoid loading all reviews" concern section 6 targets (that's about
    // public aggregate calculations over potentially large per-doctor/per-clinic review sets).
    const [doctorResult, clinicResult] = await Promise.all([
      reviewsRepository.listMyDoctorReviews(patient.id, 1, 1000),
      reviewsRepository.listMyClinicReviews(patient.id, 1, 1000),
    ]);
    const combined = [...doctorResult.items.map(toMyDoctorReviewDto), ...clinicResult.items.map(toMyClinicReviewDto)].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const total = doctorResult.total + clinicResult.total;
    const start = (query.page - 1) * query.limit;
    return { items: combined.slice(start, start + query.limit), page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) };
  },

  async update(userId: string, reviewId: string, input: UpdateReviewInput): Promise<MyReviewDto> {
    const patient = await patientRepository.findByUserIdOrThrow(userId);

    const doctorReview = await reviewsRepository.findDoctorReviewById(reviewId);
    if (doctorReview) {
      if (doctorReview.patientId !== patient.id) throw new NotFoundError('Review');
      if (!canEditOrDeleteReview(doctorReview)) {
        throw new ForbiddenError('This review can no longer be edited');
      }
      const updated = await reviewsRepository.updateDoctorReview(reviewId, {
        rating: input.rating,
        consultationExperience: input.consultationExperience,
        communication: input.communication,
        professionalism: input.professionalism,
        explanationClarity: input.explanationClarity,
        comment: input.comment,
      });
      if (input.rating !== undefined) await recomputeDoctorRating(updated.doctorId);
      recordAuditLog({ actorUserId: userId, action: 'review.edited', entityType: 'DoctorReview', entityId: reviewId });
      const doctor = await reviewDoctorRef(updated.doctorId);
      return toMyDoctorReviewDto({ ...updated, doctor, appointment: updated.appointmentId ? { bookingReference: (await reviewAppointmentRef(updated.appointmentId))! } : null });
    }

    const clinicReview = await reviewsRepository.findClinicReviewById(reviewId);
    if (clinicReview) {
      if (clinicReview.patientId !== patient.id) throw new NotFoundError('Review');
      if (!canEditOrDeleteReview(clinicReview)) {
        throw new ForbiddenError('This review can no longer be edited');
      }
      const updated = await reviewsRepository.updateClinicReview(reviewId, {
        rating: input.rating,
        staffExperience: input.staffExperience,
        cleanliness: input.cleanliness,
        waitingExperience: input.waitingExperience,
        overallExperience: input.overallExperience,
        comment: input.comment,
      });
      if (input.rating !== undefined) await recomputeClinicRating(updated.clinicId);
      recordAuditLog({ actorUserId: userId, action: 'review.edited', entityType: 'ClinicReview', entityId: reviewId });
      const clinic = await reviewClinicRef(updated.clinicId);
      const bookingReference = (await reviewAppointmentRef(updated.appointmentId))!;
      return toMyClinicReviewDto({ ...updated, clinic, appointment: { bookingReference } });
    }

    throw new NotFoundError('Review');
  },

  async delete(userId: string, reviewId: string): Promise<void> {
    const patient = await patientRepository.findByUserIdOrThrow(userId);

    const doctorReview = await reviewsRepository.findDoctorReviewById(reviewId);
    if (doctorReview) {
      if (doctorReview.patientId !== patient.id) throw new NotFoundError('Review');
      if (!canEditOrDeleteReview(doctorReview)) {
        throw new ForbiddenError('This review can no longer be deleted');
      }
      await reviewsRepository.deleteDoctorReview(reviewId);
      await recomputeDoctorRating(doctorReview.doctorId);
      recordAuditLog({ actorUserId: userId, action: 'review.deleted', entityType: 'DoctorReview', entityId: reviewId });
      return;
    }

    const clinicReview = await reviewsRepository.findClinicReviewById(reviewId);
    if (clinicReview) {
      if (clinicReview.patientId !== patient.id) throw new NotFoundError('Review');
      if (!canEditOrDeleteReview(clinicReview)) {
        throw new ForbiddenError('This review can no longer be deleted');
      }
      await reviewsRepository.deleteClinicReview(reviewId);
      await recomputeClinicRating(clinicReview.clinicId);
      recordAuditLog({ actorUserId: userId, action: 'review.deleted', entityType: 'ClinicReview', entityId: reviewId });
      return;
    }

    throw new NotFoundError('Review');
  },
};

async function reviewDoctorRef(doctorId: string) {
  return prisma.doctor.findUniqueOrThrow({ where: { id: doctorId }, select: { id: true, displayName: true } });
}

async function reviewClinicRef(clinicId: string) {
  return prisma.clinic.findUniqueOrThrow({ where: { id: clinicId }, select: { id: true, name: true } });
}

async function reviewAppointmentRef(appointmentId: string | null) {
  if (!appointmentId) return null;
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId }, select: { bookingReference: true } });
  return appt?.bookingReference ?? null;
}
