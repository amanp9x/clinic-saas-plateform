import type {
  Appointment,
  Clinic,
  ClinicDoctor,
  Doctor,
  DoctorAvailability,
  DoctorLeave,
  DoctorReview,
  DoctorSession,
  Patient,
  Prescription,
  Specialization,
  User,
} from '@prisma/client';
import type {
  ClinicAssociationDto,
  DoctorAppointmentSummaryDto,
  DoctorLeaveDto,
  DoctorProfileDto,
  DoctorReviewDetailDto,
  DoctorScheduleSlotDto,
  DoctorSessionDto,
} from '@clinic/shared';
import { calculateAge } from '../../utils/age.js';

function timeToString(time: Date): string {
  return time.toISOString().slice(11, 16);
}

function effectiveFee(doctor: Doctor, override: ClinicDoctor['consultationFeeOverride']): string | null {
  const value = override ?? doctor.consultationFee;
  return value ? value.toString() : null;
}

export function toProfileDto(doctor: Doctor & { user: User; specialization: Specialization | null }): DoctorProfileDto {
  return {
    id: doctor.id,
    slug: doctor.slug,
    displayName: doctor.displayName,
    email: doctor.user.email,
    phone: doctor.user.phone,
    specializationId: doctor.specializationId,
    specializationName: doctor.specialization?.name ?? null,
    qualifications: doctor.qualifications,
    bio: doctor.bio,
    gender: doctor.gender,
    languages: doctor.languages,
    yearsExperience: doctor.yearsExperience,
    consultationFee: doctor.consultationFee ? doctor.consultationFee.toString() : null,
    profileImageUrl: doctor.profileImageUrl,
    onlineConsultation: doctor.onlineConsultation,
    ratingAverage: doctor.ratingAverage,
    ratingCount: doctor.ratingCount,
    isActive: doctor.isActive,
  };
}

export function toClinicAssociationDto(
  clinicDoctor: ClinicDoctor & { clinic: Clinic },
  doctor: Doctor,
): ClinicAssociationDto {
  return {
    clinicId: clinicDoctor.clinicId,
    clinicName: clinicDoctor.clinic.name,
    clinicSlug: clinicDoctor.clinic.slug,
    city: clinicDoctor.clinic.city,
    isActive: clinicDoctor.isActive,
    timings: clinicDoctor.timings,
    availableDays: clinicDoctor.availableDays,
    consultationFeeOverride: clinicDoctor.consultationFeeOverride ? clinicDoctor.consultationFeeOverride.toString() : null,
    consultationDurationMinutesOverride: clinicDoctor.consultationDurationMinutesOverride,
    isAcceptingAppointments: clinicDoctor.isAcceptingAppointments,
    canOverrideDelay: clinicDoctor.canOverrideDelay,
    effectiveConsultationFee: effectiveFee(doctor, clinicDoctor.consultationFeeOverride),
  };
}

export function toScheduleSlotDto(
  slot: DoctorAvailability & { clinicDoctor: ClinicDoctor & { clinic: Clinic } },
): DoctorScheduleSlotDto {
  return {
    id: slot.id,
    clinicId: slot.clinicDoctor.clinicId,
    clinicName: slot.clinicDoctor.clinic.name,
    weekday: slot.weekday,
    startTime: timeToString(slot.startTime),
    endTime: timeToString(slot.endTime),
    consultationDurationMinutes: slot.consultationDurationMinutes,
    breakStartTime: slot.breakStartTime ? timeToString(slot.breakStartTime) : null,
    breakEndTime: slot.breakEndTime ? timeToString(slot.breakEndTime) : null,
    isActive: slot.isActive,
  };
}

export function toLeaveDto(leave: DoctorLeave & { clinic: Clinic | null }): DoctorLeaveDto {
  return {
    id: leave.id,
    clinicId: leave.clinicId,
    clinicName: leave.clinic?.name ?? null,
    startDate: leave.startDate.toISOString().slice(0, 10),
    endDate: leave.endDate.toISOString().slice(0, 10),
    reason: leave.reason,
    type: leave.type,
  };
}

export function toDoctorAppointmentSummary(
  appointment: Appointment & { patient: Patient; clinic: Clinic; prescriptions: Pick<Prescription, 'id'>[] },
): DoctorAppointmentSummaryDto {
  return {
    id: appointment.id,
    patientId: appointment.patientId,
    patientName: appointment.patient.fullName,
    patientAge: calculateAge(appointment.patient.dateOfBirth),
    patientGender: appointment.patient.gender,
    patientProfileImageUrl: appointment.patient.profileImageUrl,
    scheduledAt: appointment.scheduledAt.toISOString(),
    reasonForVisit: appointment.reasonForVisit,
    tokenNumber: appointment.tokenNumber,
    clinicId: appointment.clinicId,
    clinicName: appointment.clinic.name,
    status: appointment.status,
    consultationFee: appointment.consultationFee ? appointment.consultationFee.toString() : null,
    hasPrescription: appointment.prescriptions.length > 0,
  };
}

export function toSessionDto(session: DoctorSession & { clinic: Clinic }): DoctorSessionDto {
  return {
    id: session.id,
    doctorId: session.doctorId,
    clinicId: session.clinicId,
    clinicName: session.clinic.name,
    sessionDate: session.sessionDate.toISOString().slice(0, 10),
    status: session.status,
    queueStatus: session.queueStatus,
    startedAt: session.startedAt ? session.startedAt.toISOString() : null,
    endedAt: session.endedAt ? session.endedAt.toISOString() : null,
    currentTokenId: session.currentTokenId,
    averageConsultationMinutes: session.averageConsultationMinutes,
    delayMinutes: session.delayMinutes,
    delayReason: session.delayReason,
    delayUpdatedAt: session.delayUpdatedAt ? session.delayUpdatedAt.toISOString() : null,
  };
}

export function toReviewDetailDto(review: DoctorReview): DoctorReviewDetailDto {
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
