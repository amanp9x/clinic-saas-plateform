import { CLINIC_PERMISSIONS, type UserRole } from '@clinic/shared';
import type { ClinicDoctorPunctualityDto, ClinicReportsDto } from '@clinic/shared';
import { AppointmentStatus } from '@prisma/client';
import { assertClinicPermission } from '../reception/reception.shared.js';
import { prisma } from '../../config/database.js';
import { startOfDay, endOfDay } from '../../utils/date.js';

export const clinicReportsService = {
  async getReports(userId: string, role: UserRole, clinicId: string, from: string, to: string): Promise<ClinicReportsDto> {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.REPORTS_VIEW);

    const rangeStart = startOfDay(new Date(`${from}T00:00:00`));
    const rangeEnd = endOfDay(new Date(`${to}T00:00:00`));

    const [appointments, sessions, tokens, clinicDoctors] = await Promise.all([
      prisma.appointment.findMany({
        where: { clinicId, scheduledAt: { gte: rangeStart, lte: rangeEnd } },
        select: { status: true, consultationFee: true },
      }),
      prisma.doctorSession.findMany({
        where: { clinicId, sessionDate: { gte: startOfDay(rangeStart), lte: startOfDay(rangeEnd) } },
        select: { doctorId: true, delayMinutes: true, averageConsultationMinutes: true },
      }),
      prisma.queueToken.findMany({
        where: { doctorSession: { clinicId, sessionDate: { gte: startOfDay(rangeStart), lte: startOfDay(rangeEnd) } } },
        select: { type: true, createdAt: true, calledAt: true },
      }),
      prisma.clinicDoctor.findMany({ where: { clinicId, status: 'ACTIVE' }, include: { doctor: true } }),
    ]);

    const completedConsultations = appointments.filter((a) => a.status === AppointmentStatus.COMPLETED).length;
    const cancelledAppointments = appointments.filter((a) => a.status === AppointmentStatus.CANCELLED).length;
    const noShows = appointments.filter((a) => a.status === AppointmentStatus.NO_SHOW).length;
    const walkIns = tokens.filter((t) => t.type === 'WALK_IN').length;

    const waitMinutes = tokens.filter((t) => t.calledAt).map((t) => Math.round((t.calledAt!.getTime() - t.createdAt.getTime()) / 60000));
    const averageWaitMinutes = waitMinutes.length ? Math.round(waitMinutes.reduce((a, b) => a + b, 0) / waitMinutes.length) : null;

    const durations = sessions.map((s) => s.averageConsultationMinutes).filter((v): v is number => v != null);
    const averageConsultationMinutes = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;

    const totalDelayMinutes = sessions.reduce((sum, s) => sum + (s.delayMinutes ?? 0), 0);

    const revenue = appointments
      .filter((a) => a.status === AppointmentStatus.COMPLETED && a.consultationFee)
      .reduce((sum, a) => sum + Number(a.consultationFee), 0);

    const doctorUtilization: ClinicDoctorPunctualityDto[] = clinicDoctors.map((cd) => {
      const doctorSessions = sessions.filter((s) => s.doctorId === cd.doctorId);
      const delays = doctorSessions.map((s) => s.delayMinutes ?? 0);
      return {
        doctorId: cd.doctorId,
        doctorName: cd.doctor.displayName,
        averageDelayMinutes: doctorSessions.length ? Math.round(delays.reduce((a, b) => a + b, 0) / doctorSessions.length) : null,
      };
    });

    return {
      range: { from, to },
      totalAppointments: appointments.length,
      completedConsultations,
      cancelledAppointments,
      noShows,
      walkIns,
      averageWaitMinutes,
      averageConsultationMinutes,
      totalDelayMinutes,
      doctorUtilization,
      revenue: revenue.toFixed(2),
    };
  },
};
