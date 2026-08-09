import { DoctorSessionStatus, QueueStatus } from '@prisma/client';
import { SOCKET_EVENTS } from '@clinic/shared';
import type {
  ClinicAssociationUpdateInput,
  DoctorDashboardClinicStatusDto,
  DoctorDashboardSummaryDto,
  DoctorEarningsSummaryDto,
  DoctorManualStatus,
  DoctorProfileUpdateInput,
  DoctorReviewSummaryDto,
  EarningsQuery,
  LeaveCreateInput,
  ReviewRespondInput,
  ScheduleSlotCreateInput,
} from '@clinic/shared';
import { doctorRepository } from './doctor.repository.js';
import { resolveDoctorOrThrow, assertClinicMembership } from './doctor.shared.js';
import {
  toClinicAssociationDto,
  toDoctorAppointmentSummary,
  toLeaveDto,
  toProfileDto,
  toReviewDetailDto,
  toScheduleSlotDto,
  toSessionDto,
} from './doctor.mappers.js';
import { prisma } from '../../config/database.js';
import { NotFoundError, ValidationError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';
import { emitToClinicRoom } from '../../sockets/emit.js';
import { endOfDay, startOfDay, startOfMonth, startOfWeek } from '../../utils/date.js';
import { saveUploadedFile, deleteUploadedFile, relativePathFromUrl } from '../../services/storage.service.js';

const PLATFORM_COMMISSION_PERCENT = 10;

function toNullable(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value === '' ? null : value;
}

function parseTimeString(hhmm: string): Date {
  const [hour, minute] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(1970, 0, 1, hour, minute, 0));
}

export const doctorService = {
  async getProfile(userId: string) {
    const doctor = await resolveDoctorOrThrow(userId);
    return toProfileDto(doctor);
  },

  async updateProfile(userId: string, input: DoctorProfileUpdateInput) {
    const doctor = await resolveDoctorOrThrow(userId);
    await doctorRepository.updateProfile(doctor.id, {
      displayName: input.displayName,
      bio: toNullable(input.bio),
      qualifications: toNullable(input.qualifications),
      languages: input.languages,
      yearsExperience: input.yearsExperience,
      consultationFee: input.consultationFee,
      onlineConsultation: input.onlineConsultation,
    });
    recordAuditLog({
      actorUserId: userId,
      action: 'doctor.profile_updated',
      entityType: 'Doctor',
      entityId: doctor.id,
    });
    return doctorService.getProfile(userId);
  },

  async uploadProfilePhoto(userId: string, file: { buffer: Buffer; originalname: string }) {
    const doctor = await resolveDoctorOrThrow(userId);
    const previousUrl = doctor.profileImageUrl;
    const { url } = await saveUploadedFile({
      buffer: file.buffer,
      originalName: file.originalname,
      subdirectory: 'doctor-avatars',
    });
    await doctorRepository.updateProfileImage(doctor.id, url);
    if (previousUrl) {
      const relative = relativePathFromUrl(previousUrl);
      if (relative) await deleteUploadedFile(relative).catch(() => undefined);
    }
    recordAuditLog({ actorUserId: userId, action: 'doctor.photo_updated', entityType: 'Doctor', entityId: doctor.id });
    return { profileImageUrl: url };
  },

  async removeProfilePhoto(userId: string) {
    const doctor = await resolveDoctorOrThrow(userId);
    if (doctor.profileImageUrl) {
      const relative = relativePathFromUrl(doctor.profileImageUrl);
      if (relative) await deleteUploadedFile(relative).catch(() => undefined);
    }
    await doctorRepository.updateProfileImage(doctor.id, null);
  },

  async listClinics(userId: string) {
    const doctor = await resolveDoctorOrThrow(userId);
    const clinics = await doctorRepository.listClinics(doctor.id);
    return clinics.map((c) => toClinicAssociationDto(c, doctor));
  },

  async updateClinicAssociation(userId: string, clinicId: string, input: ClinicAssociationUpdateInput) {
    const doctor = await resolveDoctorOrThrow(userId);
    const membership = await assertClinicMembership(doctor.id, clinicId);
    const updated = await doctorRepository.updateClinicAssociation(membership.id, {
      consultationFeeOverride: input.consultationFeeOverride,
      consultationDurationMinutesOverride: input.consultationDurationMinutesOverride,
      isAcceptingAppointments: input.isAcceptingAppointments,
      timings: input.timings,
      availableDays: input.availableDays,
    });
    recordAuditLog({
      actorUserId: userId,
      action: 'doctor.clinic_association_updated',
      entityType: 'ClinicDoctor',
      entityId: membership.id,
    });
    return toClinicAssociationDto(updated, doctor);
  },

  async listSchedule(userId: string) {
    const doctor = await resolveDoctorOrThrow(userId);
    const slots = await doctorRepository.listAvailability(doctor.id);
    return slots.map(toScheduleSlotDto);
  },

  async createScheduleSlot(userId: string, input: ScheduleSlotCreateInput) {
    const doctor = await resolveDoctorOrThrow(userId);
    const membership = await assertClinicMembership(doctor.id, input.clinicId);
    const slot = await doctorRepository.createAvailability(membership.id, {
      weekday: input.weekday,
      startTime: parseTimeString(input.startTime),
      endTime: parseTimeString(input.endTime),
      consultationDurationMinutes: input.consultationDurationMinutes,
      breakStartTime: input.breakStartTime ? parseTimeString(input.breakStartTime) : null,
      breakEndTime: input.breakEndTime ? parseTimeString(input.breakEndTime) : null,
      isActive: input.isActive,
    });
    recordAuditLog({ actorUserId: userId, action: 'doctor.schedule_slot_created', entityType: 'DoctorAvailability', entityId: slot.id });
    return toScheduleSlotDto(slot);
  },

  async updateScheduleSlot(userId: string, id: string, input: ScheduleSlotCreateInput) {
    const doctor = await resolveDoctorOrThrow(userId);
    const existing = await doctorRepository.findAvailability(id, doctor.id);
    if (!existing) {
      throw new NotFoundError('Schedule slot');
    }
    if (existing.clinicDoctor.clinicId !== input.clinicId) {
      await assertClinicMembership(doctor.id, input.clinicId);
    }
    const slot = await doctorRepository.updateAvailability(id, {
      weekday: input.weekday,
      startTime: parseTimeString(input.startTime),
      endTime: parseTimeString(input.endTime),
      consultationDurationMinutes: input.consultationDurationMinutes,
      breakStartTime: input.breakStartTime ? parseTimeString(input.breakStartTime) : null,
      breakEndTime: input.breakEndTime ? parseTimeString(input.breakEndTime) : null,
      isActive: input.isActive,
    });
    recordAuditLog({ actorUserId: userId, action: 'doctor.schedule_slot_updated', entityType: 'DoctorAvailability', entityId: id });
    return toScheduleSlotDto(slot);
  },

  async deleteScheduleSlot(userId: string, id: string) {
    const doctor = await resolveDoctorOrThrow(userId);
    const existing = await doctorRepository.findAvailability(id, doctor.id);
    if (!existing) {
      throw new NotFoundError('Schedule slot');
    }
    await doctorRepository.deleteAvailability(id);
    recordAuditLog({ actorUserId: userId, action: 'doctor.schedule_slot_deleted', entityType: 'DoctorAvailability', entityId: id });
  },

  async listLeaves(userId: string) {
    const doctor = await resolveDoctorOrThrow(userId);
    const leaves = await doctorRepository.listLeaves(doctor.id);
    return leaves.map(toLeaveDto);
  },

  async createLeave(userId: string, input: LeaveCreateInput) {
    const doctor = await resolveDoctorOrThrow(userId);
    if (input.clinicId) {
      await assertClinicMembership(doctor.id, input.clinicId);
    }
    const leave = await doctorRepository.createLeave(doctor.id, {
      clinicId: input.clinicId ?? null,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      reason: toNullable(input.reason) ?? null,
      type: input.type,
    });
    recordAuditLog({ actorUserId: userId, action: 'doctor.leave_created', entityType: 'DoctorLeave', entityId: leave.id });
    return toLeaveDto(leave);
  },

  async deleteLeave(userId: string, id: string) {
    const doctor = await resolveDoctorOrThrow(userId);
    const existing = await doctorRepository.findLeave(id, doctor.id);
    if (!existing) {
      throw new NotFoundError('Leave');
    }
    await doctorRepository.deleteLeave(id);
    recordAuditLog({ actorUserId: userId, action: 'doctor.leave_deleted', entityType: 'DoctorLeave', entityId: id });
  },

  async getStatus(userId: string) {
    const doctor = await resolveDoctorOrThrow(userId);
    const [clinics, sessions] = await Promise.all([
      doctorRepository.listClinics(doctor.id),
      doctorRepository.listTodaySessions(doctor.id),
    ]);
    const sessionByClinic = new Map(sessions.map((s) => [s.clinicId, s]));
    return clinics
      .filter((c) => c.isActive)
      .map((c) => {
        const session = sessionByClinic.get(c.clinicId);
        return session
          ? toSessionDto(session)
          : {
              id: '',
              doctorId: doctor.id,
              clinicId: c.clinicId,
              clinicName: c.clinic.name,
              sessionDate: startOfDay().toISOString().slice(0, 10),
              status: DoctorSessionStatus.NOT_ARRIVED,
              queueStatus: QueueStatus.CLOSED,
              startedAt: null,
              endedAt: null,
              currentTokenId: null,
              averageConsultationMinutes: null,
              delayMinutes: null,
              delayReason: null,
              delayUpdatedAt: null,
            };
      });
  },

  async updateStatus(userId: string, clinicId: string, status: DoctorManualStatus) {
    const doctor = await resolveDoctorOrThrow(userId);
    await assertClinicMembership(doctor.id, clinicId);
    const session = await doctorRepository.upsertManualStatus(doctor.id, clinicId, status as DoctorSessionStatus);
    recordAuditLog({
      actorUserId: userId,
      action: 'doctor.status_updated',
      entityType: 'DoctorSession',
      entityId: session.id,
      metadata: { status, clinicId },
    });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.DOCTOR.STATUS_UPDATED, { clinicId, status: session.status });
    return toSessionDto(session);
  },

  async getDashboard(userId: string): Promise<DoctorDashboardSummaryDto> {
    const doctor = await resolveDoctorOrThrow(userId);

    const [
      todayAppointmentsCount,
      upcomingAppointmentsCount,
      completedConsultationsCount,
      pendingConsultationsCount,
      todayPatientsCount,
      sessions,
      clinics,
      earningsAgg,
      nextAppointment,
    ] = await Promise.all([
      doctorRepository.countTodayAppointments(doctor.id),
      doctorRepository.countUpcomingAppointments(doctor.id),
      doctorRepository.countTodayCompletedConsultations(doctor.id),
      doctorRepository.countTodayPendingConsultations(doctor.id),
      doctorRepository.countTodayDistinctPatients(doctor.id),
      doctorRepository.listTodaySessions(doctor.id),
      doctorRepository.listClinics(doctor.id),
      doctorRepository.earningsAggregate(doctor.id, startOfDay(), endOfDay()),
      doctorRepository.findNextAppointment(doctor.id),
    ]);

    const sessionByClinic = new Map(sessions.map((s) => [s.clinicId, s]));
    const activeClinics = clinics.filter((c) => c.isActive);

    const clinicStatuses: DoctorDashboardClinicStatusDto[] = await Promise.all(
      activeClinics.map(async (cd) => {
        const session = sessionByClinic.get(cd.clinicId);
        let currentTokenNumber: number | null = null;
        if (session?.currentTokenId) {
          const token = await prisma.queueToken.findUnique({
            where: { id: session.currentTokenId },
            select: { tokenNumber: true },
          });
          currentTokenNumber = token?.tokenNumber ?? null;
        }
        return {
          clinicId: cd.clinicId,
          clinicName: cd.clinic.name,
          status: session?.status ?? DoctorSessionStatus.NOT_ARRIVED,
          queueStatus: session?.queueStatus ?? QueueStatus.CLOSED,
          currentTokenNumber,
          waitingCount: session?.tokens.length ?? 0,
          delayMinutes: session?.delayMinutes ?? null,
        };
      }),
    );

    const avgList = sessions
      .map((s) => s.averageConsultationMinutes)
      .filter((v): v is number => v !== null && v !== undefined);
    const averageConsultationMinutes = avgList.length
      ? Math.round(avgList.reduce((a, b) => a + b, 0) / avgList.length)
      : null;

    const waitingPatientsCount = clinicStatuses.reduce((sum, c) => sum + c.waitingCount, 0);

    return {
      todayAppointmentsCount,
      upcomingAppointmentsCount,
      completedConsultationsCount,
      pendingConsultationsCount,
      todayPatientsCount,
      clinicStatuses,
      waitingPatientsCount,
      averageConsultationMinutes,
      todaysEarnings: (earningsAgg._sum.consultationFee ?? 0).toString(),
      ratingAverage: doctor.ratingAverage,
      ratingCount: doctor.ratingCount,
      nextAppointment: nextAppointment ? toDoctorAppointmentSummary(nextAppointment) : null,
    };
  },

  async getEarnings(userId: string, query: EarningsQuery): Promise<DoctorEarningsSummaryDto> {
    const doctor = await resolveDoctorOrThrow(userId);
    const now = new Date();
    const from = query.range === 'today' ? startOfDay(now) : query.range === 'week' ? startOfWeek(now) : startOfMonth(now);
    const agg = await doctorRepository.earningsAggregate(doctor.id, from, endOfDay(now));

    const total = Number(agg._sum.consultationFee ?? 0);
    const commission = Math.round(((total * PLATFORM_COMMISSION_PERCENT) / 100) * 100) / 100;
    const net = Math.round((total - commission) * 100) / 100;

    return {
      range: query.range,
      totalEarnings: total.toFixed(2),
      completedConsultations: agg._count._all,
      platformCommissionPercent: PLATFORM_COMMISSION_PERCENT,
      platformCommissionAmount: commission.toFixed(2),
      netEarnings: net.toFixed(2),
      pendingSettlements: net.toFixed(2),
    };
  },

  async listReviews(userId: string): Promise<DoctorReviewSummaryDto> {
    const doctor = await resolveDoctorOrThrow(userId);
    const reviews = await doctorRepository.listReviews(doctor.id, 20);
    const breakdownMap = new Map<number, number>([5, 4, 3, 2, 1].map((r) => [r, 0]));
    for (const review of reviews) {
      breakdownMap.set(review.rating, (breakdownMap.get(review.rating) ?? 0) + 1);
    }
    return {
      ratingAverage: doctor.ratingAverage,
      ratingCount: doctor.ratingCount,
      breakdown: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: breakdownMap.get(rating) ?? 0 })),
      recentReviews: reviews.map(toReviewDetailDto),
    };
  },

  async respondToReview(userId: string, reviewId: string, input: ReviewRespondInput) {
    const doctor = await resolveDoctorOrThrow(userId);
    const review = await doctorRepository.findReview(reviewId, doctor.id);
    if (!review) {
      throw new NotFoundError('Review');
    }
    if (review.response) {
      throw new ValidationError('This review already has a response');
    }
    const updated = await doctorRepository.respondToReview(reviewId, input.response);
    recordAuditLog({ actorUserId: userId, action: 'doctor.review_responded', entityType: 'DoctorReview', entityId: reviewId });
    return toReviewDetailDto(updated);
  },
};
