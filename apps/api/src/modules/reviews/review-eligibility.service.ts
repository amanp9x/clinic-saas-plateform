import type { ReviewEligibilityDto } from '@clinic/shared';
import { patientRepository } from '../patient/patient.repository.js';
import { NotFoundError, ConflictError } from '../../utils/app-error.js';
import { reviewsRepository } from './reviews.repository.js';

export type AppointmentForReview = NonNullable<Awaited<ReturnType<typeof reviewsRepository.findAppointmentForReview>>>;

/** Resolves the appointment for a review action and enforces ownership — 404, not 403, for a
 * foreign appointment (never confirms existence to a non-owner, same IDOR-safe convention as
 * payment/booking ownership checks throughout this codebase). */
export async function resolveOwnedAppointment(userId: string, appointmentId: string): Promise<AppointmentForReview> {
  const patient = await patientRepository.findByUserId(userId);
  if (!patient) throw new NotFoundError('Patient profile');

  const appointment = await reviewsRepository.findAppointmentForReview(appointmentId);
  if (!appointment || appointment.patientId !== patient.id) {
    throw new NotFoundError('Appointment');
  }
  return appointment;
}

/** The single eligibility rule, shared by GET /reviews/eligible and POST /reviews — the create
 * path always re-derives this itself rather than trusting a prior eligibility check, since state
 * (consultation completion, an existing review) can change between the two calls. */
export function assertAppointmentReviewable(appointment: AppointmentForReview): void {
  if (appointment.status !== 'COMPLETED') {
    throw new ConflictError('This appointment has not been completed yet');
  }
  // "Consultation was completed where applicable" — only enforced when a Consultation row
  // actually exists for this appointment; some completed appointments (e.g. simple walk-ins)
  // never go through the structured consultation module at all.
  if (appointment.consultation && appointment.consultation.status !== 'COMPLETED') {
    throw new ConflictError('The consultation for this appointment has not been completed yet');
  }
}

export function toEligibilityDto(appointment: AppointmentForReview): ReviewEligibilityDto {
  const reviewable = appointment.status === 'COMPLETED' && (!appointment.consultation || appointment.consultation.status === 'COMPLETED');
  return {
    appointmentId: appointment.id,
    bookingReference: appointment.bookingReference,
    doctorId: appointment.doctorId,
    doctorName: appointment.doctor.displayName,
    clinicId: appointment.clinicId,
    clinicName: appointment.clinic.name,
    scheduledAt: appointment.scheduledAt.toISOString(),
    canReviewDoctor: reviewable && !appointment.doctorReview,
    canReviewClinic: reviewable && !appointment.clinicReview,
    existingDoctorReviewId: appointment.doctorReview?.id ?? null,
    existingClinicReviewId: appointment.clinicReview?.id ?? null,
  };
}
