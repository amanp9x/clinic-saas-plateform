import { UserRole } from '@clinic/shared';
import type {
  AppointmentReportRowDto,
  ClinicPermission,
  DateRangePreset,
  PaginatedResult,
  PatientReportRowDto,
  QueueReportRowDto,
  RevenueReportRowDto,
} from '@clinic/shared';
import type { AppointmentStatus, PaymentTransactionStatus } from '@prisma/client';
import { CLINIC_PERMISSIONS } from '@clinic/shared';
import { analyticsRepository } from './analytics.repository.js';
import { analyticsService } from './analytics.service.js';
import { resolveDateRange } from './analytics.util.js';
import { assertClinicAnalyticsAccess, assertDoctorOwnScope } from './analytics-access.js';

export interface ReportFilters {
  range: DateRangePreset;
  from?: string;
  to?: string;
  doctorId?: string;
  status?: string;
  paymentStatus?: string;
  consultationType?: string;
  page: number;
  limit: number;
  sortDir: 'asc' | 'desc';
}

function paginate<T>(items: T[], total: number, page: number, limit: number): PaginatedResult<T> {
  return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

async function resolveScope(
  userId: string,
  role: UserRole,
  clinicId: string,
  requestedDoctorId: string | undefined,
  permission: ClinicPermission = CLINIC_PERMISSIONS.ANALYTICS_VIEW,
): Promise<string | undefined> {
  if (role === UserRole.DOCTOR) {
    return assertDoctorOwnScope(userId, clinicId);
  }
  await assertClinicAnalyticsAccess(userId, role, clinicId, permission);
  return requestedDoctorId;
}

export const analyticsReportsService = {
  async appointmentReport(userId: string, role: UserRole, clinicId: string, filters: ReportFilters): Promise<PaginatedResult<AppointmentReportRowDto>> {
    const doctorId = await resolveScope(userId, role, clinicId, filters.doctorId);
    const range = resolveDateRange(filters);
    const { total, items } = await analyticsRepository.appointmentReportRows(
      { clinicId, start: range.start, end: range.end, doctorId, status: filters.status as AppointmentStatus | undefined, consultationType: filters.consultationType },
      filters.page,
      filters.limit,
      filters.sortDir,
    );
    const rows: AppointmentReportRowDto[] = items.map((a) => ({
      appointmentId: a.id,
      bookingReference: a.bookingReference,
      patientName: a.patient.fullName,
      doctorName: a.doctor.displayName,
      scheduledAt: a.scheduledAt.toISOString(),
      status: a.status,
      consultationType: a.consultationType,
      checkedInAt: a.queueToken?.createdAt.toISOString() ?? null,
      completedAt: a.completedAt?.toISOString() ?? null,
    }));
    return paginate(rows, total, filters.page, filters.limit);
  },

  async revenueReport(userId: string, role: UserRole, clinicId: string, filters: ReportFilters): Promise<PaginatedResult<RevenueReportRowDto>> {
    const doctorId = await resolveScope(userId, role, clinicId, filters.doctorId, CLINIC_PERMISSIONS.ANALYTICS_REVENUE_VIEW);
    const range = resolveDateRange(filters);
    const { total, items } = await analyticsRepository.revenueReportRows(
      { clinicId, start: range.start, end: range.end, doctorId, status: filters.paymentStatus as PaymentTransactionStatus | undefined },
      filters.page,
      filters.limit,
      filters.sortDir,
    );
    const rows: RevenueReportRowDto[] = items.map((p) => ({
      paymentId: p.id,
      bookingReference: p.appointment.bookingReference,
      patientName: p.patient.fullName,
      doctorName: p.doctor.displayName,
      status: p.status,
      amount: Number(p.amount),
      currency: p.currency,
      method: p.method,
      capturedAt: p.capturedAt?.toISOString() ?? null,
    }));
    return paginate(rows, total, filters.page, filters.limit);
  },

  async doctorReport(userId: string, role: UserRole, clinicId: string, filters: ReportFilters) {
    const { rows } = await analyticsService.getDoctorPerformance(userId, role, clinicId, filters, filters.doctorId);
    const total = rows.length;
    const start = (filters.page - 1) * filters.limit;
    return paginate(rows.slice(start, start + filters.limit), total, filters.page, filters.limit);
  },

  async queueReport(userId: string, role: UserRole, clinicId: string, filters: ReportFilters): Promise<PaginatedResult<QueueReportRowDto>> {
    const doctorId = await resolveScope(userId, role, clinicId, filters.doctorId);
    const range = resolveDateRange(filters);
    const sessions = await analyticsRepository.doctorSessionsInRange({ clinicId, start: range.start, end: range.end, doctorId });
    const total = sessions.length;
    const start = (filters.page - 1) * filters.limit;
    const pageSessions = sessions.slice(start, start + filters.limit);

    const rows: QueueReportRowDto[] = [];
    for (const session of pageSessions) {
      const tokens = await analyticsRepository.queueTokensForSession(session.id);
      const waitMinutes = tokens.filter((t) => t.calledAt).map((t) => (t.calledAt!.getTime() - t.createdAt.getTime()) / 60_000);
      const avgWait = waitMinutes.length ? waitMinutes.reduce((a, b) => a + b, 0) / waitMinutes.length : null;
      rows.push({
        sessionId: session.id,
        doctorId: session.doctorId,
        doctorName: session.doctor.displayName,
        sessionDate: session.sessionDate.toISOString(),
        checkedIn: tokens.length,
        called: tokens.filter((t) => t.calledAt).length,
        completed: tokens.filter((t) => t.status === 'COMPLETED').length,
        skipped: tokens.filter((t) => t.status === 'SKIPPED').length,
        averageWaitingMinutes: avgWait !== null ? Math.round(avgWait * 100) / 100 : null,
        delayMinutes: session.delayMinutes,
      });
    }
    return paginate(rows, total, filters.page, filters.limit);
  },

  async patientReport(userId: string, role: UserRole, clinicId: string, filters: ReportFilters): Promise<PaginatedResult<PatientReportRowDto>> {
    await assertClinicAnalyticsAccess(userId, role, clinicId, CLINIC_PERMISSIONS.ANALYTICS_VIEW);
    const range = resolveDateRange(filters);
    const { total, grouped, patients, statusRows, firstVisits } = await analyticsRepository.patientReportRows(clinicId, range.start, range.end, filters.page, filters.limit);
    const nameById = new Map(patients.map((p) => [p.id, p.fullName]));
    const firstVisitById = new Map(firstVisits.map((f) => [f.patientId, f._min.scheduledAt!]));

    const rows: PatientReportRowDto[] = grouped.map((g) => {
      const statusesForPatient = statusRows.filter((s) => s.patientId === g.patientId);
      const completed = statusesForPatient.find((s) => s.status === 'COMPLETED')?._count._all ?? 0;
      const cancelled = statusesForPatient.find((s) => s.status === 'CANCELLED')?._count._all ?? 0;
      const noShow = statusesForPatient.find((s) => s.status === 'NO_SHOW')?._count._all ?? 0;
      const firstVisitAt = firstVisitById.get(g.patientId)!;
      return {
        patientId: g.patientId,
        patientName: nameById.get(g.patientId) ?? 'Unknown',
        appointments: g._count._all,
        completed,
        cancelled,
        noShow,
        firstVisitAt: firstVisitAt.toISOString(),
        isNewInRange: firstVisitAt >= range.start,
      };
    });
    return paginate(rows, total, filters.page, filters.limit);
  },
};
