import type { DoctorSessionStatus, QueueStatus } from '@prisma/client';
import type { ClinicDoctorDetailDto, ClinicDoctorSummaryDto, ExistingDoctorSearchResultDto } from '@clinic/shared';
import type { Doctor, Specialization } from '@prisma/client';
import type { ClinicDoctorWithRelations } from './clinic-doctors.repository.js';

interface SessionInfo {
  status: DoctorSessionStatus;
  queueStatus: QueueStatus;
}

export function toClinicDoctorSummary(assoc: ClinicDoctorWithRelations, session: SessionInfo | null): ClinicDoctorSummaryDto {
  return {
    clinicDoctorId: assoc.id,
    doctorId: assoc.doctorId,
    doctorName: assoc.doctor.displayName,
    specializationName: assoc.doctor.specialization?.name ?? null,
    yearsExperience: assoc.doctor.yearsExperience,
    status: assoc.status,
    departmentId: assoc.departmentId,
    departmentName: assoc.department?.name ?? null,
    consultationFee: assoc.consultationFeeOverride ? assoc.consultationFeeOverride.toString() : (assoc.doctor.consultationFee?.toString() ?? null),
    consultationDurationMinutes: assoc.consultationDurationMinutesOverride,
    consultationTypes: assoc.consultationTypes,
    availableDays: assoc.availableDays,
    queueEnabled: assoc.queueEnabled,
    isAcceptingAppointments: assoc.isAcceptingAppointments,
    startDate: assoc.startDate ? assoc.startDate.toISOString().slice(0, 10) : null,
    endDate: assoc.endDate ? assoc.endDate.toISOString().slice(0, 10) : null,
    currentDoctorStatus: session?.status ?? null,
    currentQueueStatus: session?.queueStatus ?? null,
  };
}

export function toClinicDoctorDetail(assoc: ClinicDoctorWithRelations, session: SessionInfo | null): ClinicDoctorDetailDto {
  return {
    ...toClinicDoctorSummary(assoc, session),
    bio: assoc.doctor.bio,
    gender: assoc.doctor.gender,
    languages: assoc.doctor.languages,
    profileImageUrl: assoc.doctor.profileImageUrl,
    timings: assoc.timings,
    canOverrideDelay: assoc.canOverrideDelay,
  };
}

export function toExistingDoctorSearchResult(
  doctor: Doctor & { specialization: Specialization | null },
  alreadyAssociated: boolean,
): ExistingDoctorSearchResultDto {
  return {
    doctorId: doctor.id,
    doctorName: doctor.displayName,
    specializationName: doctor.specialization?.name ?? null,
    yearsExperience: doctor.yearsExperience,
    alreadyAssociated,
  };
}
