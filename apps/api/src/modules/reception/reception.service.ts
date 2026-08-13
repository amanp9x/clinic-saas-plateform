import { CLINIC_PERMISSIONS, SOCKET_EVENTS, type UserRole } from '@clinic/shared';
import type { DoctorSessionStatus } from '@prisma/client';
import type { ReceptionDashboardSummaryDto, ReceptionDoctorQueueStatusDto, ReceptionReportsDto, ClinicStaffProfileDto, DoctorPunctualityDto, PeakHourDto } from '@clinic/shared';
import { prisma } from '../../config/database.js';
import { doctorRepository } from '../doctor/doctor.repository.js';
import { queueRepository } from '../doctor-queue/queue.repository.js';
import { calculateEta } from '../queue-engine/eta.service.js';
import { assertClinicPermission, listStaffClinics, requireDoctorAtClinic } from './reception.shared.js';
import { startOfDay, endOfDay } from '../../utils/date.js';
import { NotFoundError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';
import { emitToClinicRoom } from '../../sockets/emit.js';

async function buildDoctorQueueStatus(doctorId: string, doctorName: string, clinicId: string): Promise<ReceptionDoctorQueueStatusDto> {
  const session = await queueRepository.findSessionWithTokens(doctorId, clinicId);
  const waitingCount = session ? session.tokens.filter((t) => t.status === 'WAITING').length : 0;
  const currentToken = session?.currentTokenId ? (session.tokens.find((t) => t.id === session.currentTokenId) ?? null) : null;

  return {
    doctorId,
    doctorName,
    status: session?.status ?? 'NOT_ARRIVED',
    queueStatus: session?.queueStatus ?? 'CLOSED',
    currentTokenNumber: currentToken?.tokenNumber ?? null,
    queueSize: waitingCount,
    delayMinutes: session?.delayMinutes ?? null,
    delayReason: session?.delayReason ?? null,
    estimatedWaitMinutes: calculateEta({
      patientsAhead: waitingCount,
      avgConsultationMinutes: session?.averageConsultationMinutes ?? null,
      delayMinutes: session?.delayMinutes ?? null,
      queueStatus: session?.queueStatus ?? null,
      doctorStatus: session?.status ?? null,
    }),
  };
}

export const receptionService = {
  async listMyClinics(userId: string, role: UserRole): Promise<ClinicStaffProfileDto[]> {
    const rows = await listStaffClinics(userId);
    return rows.map((r) => ({
      userId: r.userId,
      clinicId: r.clinicId,
      clinicName: r.clinic.name,
      title: r.title,
      role,
      permissions: r.permissions,
      isActive: r.isActive,
    }));
  },

  async dashboard(userId: string, role: UserRole, clinicId: string): Promise<ReceptionDashboardSummaryDto> {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.QUEUE_VIEW);
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) throw new NotFoundError('Clinic');

    const [todayAppointments, walkInsCount, clinicDoctors] = await Promise.all([
      prisma.appointment.findMany({
        where: { clinicId, scheduledAt: { gte: startOfDay(), lte: endOfDay() } },
        select: { status: true },
      }),
      prisma.queueToken.count({
        where: { type: 'WALK_IN', doctorSession: { clinicId, sessionDate: startOfDay() } },
      }),
      prisma.clinicDoctor.findMany({ where: { clinicId, isActive: true }, include: { doctor: true } }),
    ]);

    const doctorQueues = await Promise.all(
      clinicDoctors.map((cd) => buildDoctorQueueStatus(cd.doctorId, cd.doctor.displayName, clinicId)),
    );

    return {
      clinicId,
      clinicName: clinic.name,
      todayTotalAppointments: todayAppointments.length,
      checkedInCount: todayAppointments.filter((a) => a.status === 'CHECKED_IN').length,
      waitingCount: doctorQueues.reduce((sum, d) => sum + d.queueSize, 0),
      inConsultationCount: todayAppointments.filter((a) => a.status === 'IN_CONSULTATION').length,
      completedCount: todayAppointments.filter((a) => a.status === 'COMPLETED').length,
      noShowCount: todayAppointments.filter((a) => a.status === 'NO_SHOW').length,
      walkInsCount,
      doctorQueues,
    };
  },

  async listDoctorStatuses(userId: string, role: UserRole, clinicId: string): Promise<ReceptionDoctorQueueStatusDto[]> {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.QUEUE_VIEW);
    const clinicDoctors = await prisma.clinicDoctor.findMany({ where: { clinicId, isActive: true }, include: { doctor: true } });
    return Promise.all(clinicDoctors.map((cd) => buildDoctorQueueStatus(cd.doctorId, cd.doctor.displayName, clinicId)));
  },

  async updateDoctorStatus(userId: string, role: UserRole, clinicId: string, doctorId: string, status: DoctorSessionStatus) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.DOCTOR_STATUS_UPDATE);
    const membership = await requireDoctorAtClinic(doctorId, clinicId);

    const session = await doctorRepository.upsertManualStatus(doctorId, clinicId, status);

    recordAuditLog({
      actorUserId: userId,
      action: 'reception.doctor_status_updated',
      entityType: 'DoctorSession',
      entityId: session.id,
      clinicId,
      metadata: { doctorId, newState: { status } },
    });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.DOCTOR.STATUS_UPDATED, { clinicId, doctorId, status });
    return buildDoctorQueueStatus(doctorId, membership.doctor.displayName, clinicId);
  },

  async reports(userId: string, role: UserRole, clinicId: string, from: string, to: string): Promise<ReceptionReportsDto> {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.REPORTS_VIEW);

    const rangeStart = startOfDay(new Date(`${from}T00:00:00`));
    const rangeEnd = endOfDay(new Date(`${to}T00:00:00`));

    const [appointments, sessions, tokens, clinicDoctors] = await Promise.all([
      prisma.appointment.findMany({
        where: { clinicId, scheduledAt: { gte: rangeStart, lte: rangeEnd } },
        select: { status: true, scheduledAt: true },
      }),
      prisma.doctorSession.findMany({
        where: { clinicId, sessionDate: { gte: startOfDay(rangeStart), lte: startOfDay(rangeEnd) } },
        select: { doctorId: true, delayMinutes: true, averageConsultationMinutes: true },
      }),
      prisma.queueToken.findMany({
        where: { doctorSession: { clinicId, sessionDate: { gte: startOfDay(rangeStart), lte: startOfDay(rangeEnd) } } },
        select: { status: true, type: true, createdAt: true, calledAt: true },
      }),
      prisma.clinicDoctor.findMany({ where: { clinicId, isActive: true }, include: { doctor: true } }),
    ]);

    const checkedInCount = appointments.filter((a) => a.status === 'CHECKED_IN' || a.status === 'IN_CONSULTATION' || a.status === 'COMPLETED').length;
    const noShowCount = appointments.filter((a) => a.status === 'NO_SHOW').length;
    const walkInsCount = tokens.filter((t) => t.type === 'WALK_IN').length;

    const waitMinutes = tokens
      .filter((t) => t.calledAt)
      .map((t) => Math.round((t.calledAt!.getTime() - t.createdAt.getTime()) / 60000));
    const averageWaitMinutes = waitMinutes.length ? Math.round(waitMinutes.reduce((a, b) => a + b, 0) / waitMinutes.length) : null;

    const avgConsultDurations = sessions.map((s) => s.averageConsultationMinutes).filter((v): v is number => v != null);
    const averageConsultationMinutes = avgConsultDurations.length
      ? Math.round(avgConsultDurations.reduce((a, b) => a + b, 0) / avgConsultDurations.length)
      : null;

    const totalDelayMinutes = sessions.reduce((sum, s) => sum + (s.delayMinutes ?? 0), 0);

    const completedTokens = tokens.filter((t) => t.status === 'COMPLETED').length;
    const terminalTokens = tokens.filter((t) => ['COMPLETED', 'SKIPPED', 'NO_SHOW'].includes(t.status)).length;
    const queueEfficiencyPercent = terminalTokens > 0 ? Math.round((completedTokens / terminalTokens) * 100) : null;

    const doctorPunctuality: DoctorPunctualityDto[] = clinicDoctors.map((cd) => {
      const doctorSessions = sessions.filter((s) => s.doctorId === cd.doctorId);
      const delays = doctorSessions.map((s) => s.delayMinutes ?? 0);
      const averageDelayMinutes = doctorSessions.length ? Math.round(delays.reduce((a, b) => a + b, 0) / doctorSessions.length) : null;
      const onTimeCount = doctorSessions.filter((s) => (s.delayMinutes ?? 0) <= 5).length;
      const onTimeRate = doctorSessions.length ? Math.round((onTimeCount / doctorSessions.length) * 100) : null;
      return { doctorId: cd.doctorId, doctorName: cd.doctor.displayName, averageDelayMinutes, onTimeRate };
    });

    const peakHourCounts = new Map<number, number>();
    for (const a of appointments) {
      const hour = a.scheduledAt.getHours();
      peakHourCounts.set(hour, (peakHourCounts.get(hour) ?? 0) + 1);
    }
    const peakHours: PeakHourDto[] = [...peakHourCounts.entries()]
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour);

    return {
      range: { from, to },
      totalAppointments: appointments.length,
      checkedInCount,
      walkInsCount,
      noShowCount,
      averageWaitMinutes,
      averageConsultationMinutes,
      totalDelayMinutes,
      queueEfficiencyPercent,
      doctorPunctuality,
      peakHours,
    };
  },
};
