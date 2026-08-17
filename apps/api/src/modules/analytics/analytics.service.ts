import { UserRole } from '@clinic/shared';
import type {
  AnalyticsOverviewDto,
  AppointmentBreakdownDto,
  DoctorPerformanceRowDto,
  PatientBreakdownDto,
  PaymentBreakdownDto,
  QueueBreakdownDto,
  RevenueBreakdownDto,
  TrendPointDto,
  ClinicComparisonRowDto,
  DoctorAvailabilityDto,
  DelayAnalyticsRowDto,
} from '@clinic/shared';
import { CLINIC_PERMISSIONS } from '@clinic/shared';
import { prisma } from '../../config/database.js';
import { ForbiddenError, NotFoundError } from '../../utils/app-error.js';
import { analyticsRepository } from './analytics.repository.js';
import { resolveDateRange, toResolvedDateRangeDto, safeDivide, roundOrNull, type ResolvedRange } from './analytics.util.js';
import { computeAvailableCapacityMinutes, computeUtilization } from './doctor-utilization.util.js';
import { assertClinicAnalyticsAccess, assertClinicExists, assertDoctorOwnScope, resolveAccessibleClinicIds } from './analytics-access.js';

async function buildAppointmentBreakdown(clinicId: string, range: ResolvedRange, doctorId?: string): Promise<AppointmentBreakdownDto> {
  const [counts, rescheduled] = await Promise.all([
    analyticsRepository.appointmentStatusCounts({ clinicId, start: range.start, end: range.end, doctorId }),
    analyticsRepository.rescheduledCount({ clinicId, start: range.start, end: range.end, doctorId }),
  ]);
  const pending = counts.PENDING ?? 0;
  const confirmed = counts.CONFIRMED ?? 0;
  const checkedIn = counts.CHECKED_IN ?? 0;
  const inConsultation = counts.IN_CONSULTATION ?? 0;
  const completed = counts.COMPLETED ?? 0;
  const cancelled = counts.CANCELLED ?? 0;
  const noShow = counts.NO_SHOW ?? 0;
  const total = pending + confirmed + checkedIn + inConsultation + completed + cancelled + noShow;
  // "Checked-in rate" = share of appointments that reached check-in or beyond (checked-in,
  // in-consultation, or completed) — cancelled/no-show/still-pending appointments never checked in.
  const everCheckedIn = checkedIn + inConsultation + completed;

  return {
    total,
    pending,
    confirmed,
    checkedIn,
    inConsultation,
    completed,
    cancelled,
    noShow,
    rescheduled,
    cancellationRate: roundOrNull(safeDivide(cancelled, total), 4),
    noShowRate: roundOrNull(safeDivide(noShow, total), 4),
    completionRate: roundOrNull(safeDivide(completed, total), 4),
    checkInRate: roundOrNull(safeDivide(everCheckedIn, total), 4),
  };
}

async function buildRevenueBreakdown(clinicId: string, range: ResolvedRange, currency: string, doctorId?: string): Promise<RevenueBreakdownDto> {
  const [totals, refunds] = await Promise.all([
    analyticsRepository.revenueTotals({ clinicId, start: range.start, end: range.end, doctorId }),
    analyticsRepository.refundTotals({ clinicId, start: range.start, end: range.end, doctorId }),
  ]);
  const netCollected = totals.grossCollected - refunds.refundedAmount;
  return {
    currency,
    grossCollected: roundOrNull(totals.grossCollected) ?? 0,
    refundedAmount: roundOrNull(refunds.refundedAmount) ?? 0,
    netCollected: roundOrNull(netCollected) ?? 0,
    pendingAmount: roundOrNull(totals.pendingAmount) ?? 0,
    failedAmount: roundOrNull(totals.failedAmount) ?? 0,
    successfulPaymentCount: totals.successfulPaymentCount,
    pendingPaymentCount: totals.pendingPaymentCount,
    failedPaymentCount: totals.failedPaymentCount,
    refundedCount: refunds.refundedCount,
    averageTransactionValue: roundOrNull(safeDivide(totals.grossCollected, totals.successfulPaymentCount)),
  };
}

async function buildPaymentBreakdown(clinicId: string, range: ResolvedRange, doctorId?: string): Promise<PaymentBreakdownDto> {
  const [totals, refunds, byProvider, byMethod] = await Promise.all([
    analyticsRepository.revenueTotals({ clinicId, start: range.start, end: range.end, doctorId }),
    analyticsRepository.refundTotals({ clinicId, start: range.start, end: range.end, doctorId }),
    analyticsRepository.revenueByProvider({ clinicId, start: range.start, end: range.end, doctorId }),
    analyticsRepository.revenueByMethod({ clinicId, start: range.start, end: range.end, doctorId }),
  ]);
  const attempted = totals.successfulPaymentCount + totals.failedPaymentCount;
  return {
    successRate: roundOrNull(safeDivide(totals.successfulPaymentCount, attempted), 4),
    failureRate: roundOrNull(safeDivide(totals.failedPaymentCount, attempted), 4),
    refundRate: roundOrNull(safeDivide(refunds.refundedCount, totals.successfulPaymentCount), 4),
    averageTransactionValue: roundOrNull(safeDivide(totals.grossCollected, totals.successfulPaymentCount)),
    byProvider,
    byMethod,
  };
}

async function buildQueueBreakdown(clinicId: string, range: ResolvedRange, doctorId?: string): Promise<QueueBreakdownDto> {
  const [tokenCounts, checkedIn, called, waiting, delay] = await Promise.all([
    analyticsRepository.queueTokenCounts({ clinicId, start: range.start, end: range.end, doctorId }),
    analyticsRepository.checkedInCount({ clinicId, start: range.start, end: range.end, doctorId }),
    analyticsRepository.calledCount({ clinicId, start: range.start, end: range.end, doctorId }),
    analyticsRepository.waitingTimeStats({ clinicId, start: range.start, end: range.end, doctorId }),
    analyticsRepository.delayAuditStats({ clinicId, start: range.start, end: range.end, doctorId }),
  ]);
  const skipped = tokenCounts.SKIPPED ?? 0;
  const completed = tokenCounts.COMPLETED ?? 0;
  const overallDelay = delay.reduce(
    (acc, d) => ({ sum: acc.sum + (d.averageDelayMinutes ?? 0) * d.delayedSessions, n: acc.n + d.delayedSessions, max: Math.max(acc.max, d.maximumDelayMinutes ?? 0) }),
    { sum: 0, n: 0, max: 0 },
  );

  return {
    checkedIn,
    called,
    skipped,
    completed,
    averageWaitingMinutes: roundOrNull(waiting.avg_minutes),
    medianWaitingMinutes: roundOrNull(waiting.median_minutes),
    maximumWaitingMinutes: roundOrNull(waiting.max_minutes),
    averageDelayMinutes: overallDelay.n > 0 ? roundOrNull(overallDelay.sum / overallDelay.n) : null,
    maximumDelayMinutes: overallDelay.n > 0 ? roundOrNull(overallDelay.max) : null,
    averageQueueSize: null,
    peakQueueSize: null,
    throughput: completed,
  };
}

async function buildPatientBreakdown(clinicId: string, range: ResolvedRange): Promise<PatientBreakdownDto> {
  const [firstVisits, perPatient] = await Promise.all([
    analyticsRepository.patientFirstVisitForRangePatients({ clinicId, start: range.start, end: range.end }),
    analyticsRepository.appointmentsPerPatient({ clinicId, start: range.start, end: range.end }),
  ]);
  const totalPatientsServed = firstVisits.length;
  const newPatients = firstVisits.filter((f) => f.firstVisitAt >= range.start).length;
  const returningPatients = totalPatientsServed - newPatients;
  const totalAppointments = perPatient.reduce((sum, p) => sum + p.count, 0);
  const repeatVisitors = perPatient.filter((p) => p.count > 1).length;

  return {
    totalPatientsServed,
    newPatients,
    returningPatients,
    activePatients: totalPatientsServed,
    averageAppointmentsPerPatient: roundOrNull(safeDivide(totalAppointments, totalPatientsServed)),
    repeatAppointmentRate: roundOrNull(safeDivide(repeatVisitors, totalPatientsServed), 4),
  };
}

export const analyticsService = {
  async getOverview(userId: string, role: UserRole, clinicId: string, rangeQuery: { range: string; from?: string; to?: string }): Promise<AnalyticsOverviewDto> {
    await assertClinicAnalyticsAccess(userId, role, clinicId, CLINIC_PERMISSIONS.ANALYTICS_VIEW);
    const [, settings] = await Promise.all([assertClinicExists(clinicId), prisma.clinicSettings.findUnique({ where: { clinicId } })]);
    const range = resolveDateRange(rangeQuery as Parameters<typeof resolveDateRange>[0]);
    const currency = settings?.currency ?? 'INR';

    const wantsRevenue = await hasRevenueAccess(userId, role, clinicId);
    const [appointments, revenue, patients, avgConsultMin, waiting] = await Promise.all([
      buildAppointmentBreakdown(clinicId, range),
      wantsRevenue ? buildRevenueBreakdown(clinicId, range, currency) : Promise.resolve(emptyRevenue(currency)),
      buildPatientBreakdown(clinicId, range),
      analyticsRepository.consultationDurationStats({ clinicId, start: range.start, end: range.end }),
      analyticsRepository.waitingTimeStats({ clinicId, start: range.start, end: range.end }),
    ]);
    const delay = await analyticsRepository.delayAuditStats({ clinicId, start: range.start, end: range.end });
    const overallDelay = delay.reduce((acc, d) => ({ sum: acc.sum + (d.averageDelayMinutes ?? 0) * d.delayedSessions, n: acc.n + d.delayedSessions }), { sum: 0, n: 0 });
    const queueThroughput = (await analyticsRepository.queueTokenCounts({ clinicId, start: range.start, end: range.end })).COMPLETED ?? 0;

    return {
      clinicId,
      range: toResolvedDateRangeDto(range),
      appointments,
      revenue,
      patients: { totalPatientsServed: patients.totalPatientsServed, newPatients: patients.newPatients, returningPatients: patients.returningPatients },
      averageConsultationMinutes: roundOrNull(avgConsultMin),
      averageDelayMinutes: overallDelay.n > 0 ? roundOrNull(overallDelay.sum / overallDelay.n) : null,
      averageWaitingMinutes: roundOrNull(waiting.avg_minutes),
      queueThroughput,
    };
  },

  async getAppointmentAnalytics(userId: string, role: UserRole, clinicId: string, rangeQuery: { range: string; from?: string; to?: string }, doctorId?: string, trend?: 'day' | 'week' | 'month') {
    await assertClinicAnalyticsAccess(userId, role, clinicId, CLINIC_PERMISSIONS.ANALYTICS_VIEW);
    await assertClinicExists(clinicId);
    const range = resolveDateRange(rangeQuery as Parameters<typeof resolveDateRange>[0]);
    const [breakdown, trendRows] = await Promise.all([
      buildAppointmentBreakdown(clinicId, range, doctorId),
      trend ? analyticsRepository.appointmentTrend({ clinicId, start: range.start, end: range.end, doctorId }, trend) : Promise.resolve([]),
    ]);
    const trendPoints: TrendPointDto[] = trendRows.map((r) => ({ bucket: r.bucket.toISOString(), count: Number(r.count) }));
    return { clinicId, range: toResolvedDateRangeDto(range), breakdown, trend: trendPoints };
  },

  async getRevenueAnalytics(
    userId: string,
    role: UserRole,
    clinicId: string,
    rangeQuery: { range: string; from?: string; to?: string },
    groupBy?: 'day' | 'week' | 'month' | 'doctor' | 'method' | 'consultationType',
  ) {
    await assertClinicAnalyticsAccess(userId, role, clinicId, CLINIC_PERMISSIONS.ANALYTICS_REVENUE_VIEW);
    const settings = await prisma.clinicSettings.findUnique({ where: { clinicId } });
    const currency = settings?.currency ?? 'INR';
    const range = resolveDateRange(rangeQuery as Parameters<typeof resolveDateRange>[0]);
    const breakdown = await buildRevenueBreakdown(clinicId, range, currency);

    let breakdownBy: unknown[] = [];
    if (groupBy === 'day' || groupBy === 'week' || groupBy === 'month') {
      const rows = await analyticsRepository.revenueTrend({ clinicId, start: range.start, end: range.end }, groupBy);
      breakdownBy = rows.map((r) => ({ bucket: r.bucket.toISOString(), amount: Number(r.amount ?? 0), count: Number(r.count) }));
    } else if (groupBy === 'doctor') {
      breakdownBy = await analyticsRepository.revenueByDoctor({ clinicId, start: range.start, end: range.end });
    } else if (groupBy === 'method') {
      breakdownBy = await analyticsRepository.revenueByMethod({ clinicId, start: range.start, end: range.end });
    } else if (groupBy === 'consultationType') {
      breakdownBy = await analyticsRepository.revenueByConsultationType({ clinicId, start: range.start, end: range.end });
    }

    return { clinicId, range: toResolvedDateRangeDto(range), breakdown, groupBy: groupBy ?? null, breakdownBy };
  },

  async getPaymentAnalytics(userId: string, role: UserRole, clinicId: string, rangeQuery: { range: string; from?: string; to?: string }) {
    await assertClinicAnalyticsAccess(userId, role, clinicId, CLINIC_PERMISSIONS.ANALYTICS_REVENUE_VIEW);
    const range = resolveDateRange(rangeQuery as Parameters<typeof resolveDateRange>[0]);
    const breakdown = await buildPaymentBreakdown(clinicId, range);
    return { clinicId, range: toResolvedDateRangeDto(range), breakdown };
  },

  async getQueueAnalytics(userId: string, role: UserRole, clinicId: string, rangeQuery: { range: string; from?: string; to?: string }, doctorId?: string) {
    await assertClinicAnalyticsAccess(userId, role, clinicId, CLINIC_PERMISSIONS.ANALYTICS_VIEW);
    await assertClinicExists(clinicId);
    const range = resolveDateRange(rangeQuery as Parameters<typeof resolveDateRange>[0]);
    const breakdown = await buildQueueBreakdown(clinicId, range, doctorId);
    return { clinicId, range: toResolvedDateRangeDto(range), breakdown };
  },

  async getPatientAnalytics(userId: string, role: UserRole, clinicId: string, rangeQuery: { range: string; from?: string; to?: string }) {
    await assertClinicAnalyticsAccess(userId, role, clinicId, CLINIC_PERMISSIONS.ANALYTICS_VIEW);
    await assertClinicExists(clinicId);
    const range = resolveDateRange(rangeQuery as Parameters<typeof resolveDateRange>[0]);
    const breakdown = await buildPatientBreakdown(clinicId, range);
    return { clinicId, range: toResolvedDateRangeDto(range), breakdown };
  },

  /**
   * Doctor performance. Two access paths:
   *  - DOCTOR role: forced to their own doctorId regardless of any client-supplied `doctorId` —
   *    never trust the client here.
   *  - CLINIC_ADMIN / permitted staff: sees every doctor at the clinic, optionally filtered to one
   *    `doctorId` (still clinic-membership-checked).
   */
  async getDoctorPerformance(
    userId: string,
    role: UserRole,
    clinicId: string,
    rangeQuery: { range: string; from?: string; to?: string },
    requestedDoctorId?: string,
  ): Promise<{ clinicId: string; range: ReturnType<typeof toResolvedDateRangeDto>; rows: DoctorPerformanceRowDto[] }> {
    const range = resolveDateRange(rangeQuery as Parameters<typeof resolveDateRange>[0]);
    let effectiveDoctorId: string | undefined;

    if (role === UserRole.DOCTOR) {
      effectiveDoctorId = await assertDoctorOwnScope(userId, clinicId);
    } else {
      await assertClinicAnalyticsAccess(userId, role, clinicId, CLINIC_PERMISSIONS.ANALYTICS_VIEW);
      effectiveDoctorId = requestedDoctorId;
    }

    const clinicDoctors = await analyticsRepository.doctorsForClinic(clinicId, effectiveDoctorId);
    const rows: DoctorPerformanceRowDto[] = [];
    for (const cd of clinicDoctors) {
      const doctorId = cd.doctorId;
      const [appointmentCounts, avgConsult, waiting, delay, bookedMin, templates, leaves, reviewCount, revenueByDoctorRows] = await Promise.all([
        analyticsRepository.appointmentStatusCounts({ clinicId, start: range.start, end: range.end, doctorId }),
        analyticsRepository.consultationDurationStats({ clinicId, start: range.start, end: range.end, doctorId }),
        analyticsRepository.waitingTimeStats({ clinicId, start: range.start, end: range.end, doctorId }),
        analyticsRepository.delayAuditStats({ clinicId, start: range.start, end: range.end, doctorId }),
        analyticsRepository.bookedMinutes({ clinicId, start: range.start, end: range.end, doctorId }),
        analyticsRepository.doctorAvailabilityTemplates(cd.id),
        analyticsRepository.doctorLeavesInRange(doctorId, clinicId, range.start, range.end),
        analyticsRepository.reviewCountInRange(doctorId, range.start, range.end),
        analyticsRepository.revenueByDoctor({ clinicId, start: range.start, end: range.end }),
      ]);
      const { capacityMinutes } = computeAvailableCapacityMinutes(range.start, range.end, templates, leaves);
      const doctorDelay = delay.find((d) => d.doctorId === doctorId);
      const completed = appointmentCounts.COMPLETED ?? 0;
      const queueThroughput = completed;
      const revenue = revenueByDoctorRows.find((r) => r.doctorId === doctorId)?.amount ?? null;

      rows.push({
        doctorId,
        doctorName: cd.doctor.displayName,
        appointments: Object.values(appointmentCounts).reduce((a, b) => a + b, 0),
        completed,
        cancelled: appointmentCounts.CANCELLED ?? 0,
        noShow: appointmentCounts.NO_SHOW ?? 0,
        averageConsultationMinutes: roundOrNull(avgConsult),
        averageWaitingMinutes: roundOrNull(waiting.avg_minutes),
        averageDelayMinutes: roundOrNull(doctorDelay?.averageDelayMinutes ?? null),
        queueThroughput,
        revenue,
        reviewCount,
        averageRating: cd.doctor.ratingAverage ?? null,
        utilization: roundOrNull(computeUtilization(bookedMin, capacityMinutes), 4),
      });
    }

    return { clinicId, range: toResolvedDateRangeDto(range), rows };
  },

  async getDoctorAvailability(userId: string, role: UserRole, clinicId: string, doctorId: string, rangeQuery: { range: string; from?: string; to?: string }): Promise<DoctorAvailabilityDto> {
    if (role === UserRole.DOCTOR) {
      const ownId = await assertDoctorOwnScope(userId, clinicId);
      if (ownId !== doctorId) throw new ForbiddenError('You may only view your own availability');
    } else {
      await assertClinicAnalyticsAccess(userId, role, clinicId, CLINIC_PERMISSIONS.ANALYTICS_VIEW);
    }
    const range = resolveDateRange(rangeQuery as Parameters<typeof resolveDateRange>[0]);
    const clinicDoctor = await prisma.clinicDoctor.findUnique({ where: { clinicId_doctorId: { clinicId, doctorId } } });
    if (!clinicDoctor) throw new NotFoundError('Doctor at this clinic');

    const [templates, leaves, bookedMin] = await Promise.all([
      analyticsRepository.doctorAvailabilityTemplates(clinicDoctor.id),
      analyticsRepository.doctorLeavesInRange(doctorId, clinicId, range.start, range.end),
      analyticsRepository.bookedMinutes({ clinicId, start: range.start, end: range.end, doctorId }),
    ]);
    const { capacityMinutes, leaveDays } = computeAvailableCapacityMinutes(range.start, range.end, templates, leaves);

    return {
      doctorId,
      availableHours: roundOrNull(capacityMinutes / 60) ?? 0,
      // "Booked hours" and "consultation hours" collapse to the same figure here: this schema has
      // no separate concept of a scheduled-but-not-yet-consulted duration distinct from booked
      // appointment duration, so both are derived from the same `Appointment.durationMinutes` sum.
      bookedHours: roundOrNull(bookedMin / 60) ?? 0,
      consultationHours: roundOrNull(bookedMin / 60) ?? 0,
      leaveDays,
      utilization: roundOrNull(computeUtilization(bookedMin, capacityMinutes), 4),
    };
  },

  async getDelayAnalytics(userId: string, role: UserRole, clinicId: string, rangeQuery: { range: string; from?: string; to?: string }): Promise<{ clinicId: string; range: ReturnType<typeof toResolvedDateRangeDto>; rows: DelayAnalyticsRowDto[] }> {
    await assertClinicAnalyticsAccess(userId, role, clinicId, CLINIC_PERMISSIONS.ANALYTICS_VIEW);
    const range = resolveDateRange(rangeQuery as Parameters<typeof resolveDateRange>[0]);
    const [stats, doctors] = await Promise.all([
      analyticsRepository.delayAuditStats({ clinicId, start: range.start, end: range.end }),
      analyticsRepository.doctorsForClinic(clinicId),
    ]);
    const nameById = new Map(doctors.map((d) => [d.doctorId, d.doctor.displayName]));
    const rows: DelayAnalyticsRowDto[] = stats.map((s) => ({
      doctorId: s.doctorId,
      doctorName: nameById.get(s.doctorId) ?? 'Unknown',
      delayedSessionCount: s.delayedSessions,
      averageDelayMinutes: roundOrNull(s.averageDelayMinutes),
      maximumDelayMinutes: roundOrNull(s.maximumDelayMinutes),
    }));
    return { clinicId, range: toResolvedDateRangeDto(range), rows };
  },

  async compareClinics(userId: string, role: UserRole, requestedClinicIds: string[], rangeQuery: { range: string; from?: string; to?: string }): Promise<{ range: ReturnType<typeof toResolvedDateRangeDto>; rows: ClinicComparisonRowDto[] }> {
    const accessible = new Set(await resolveAccessibleClinicIds(userId, role, CLINIC_PERMISSIONS.ANALYTICS_VIEW));
    // Never trust client-supplied clinicIds — intersect with the server-derived accessible set.
    const clinicIds = requestedClinicIds.filter((id) => accessible.has(id));
    const range = resolveDateRange(rangeQuery as Parameters<typeof resolveDateRange>[0]);

    const rows: ClinicComparisonRowDto[] = [];
    for (const clinicId of clinicIds) {
      const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { name: true } });
      if (!clinic) continue;
      const [appointments, revenue, patients, waiting, doctorRows] = await Promise.all([
        buildAppointmentBreakdown(clinicId, range),
        buildRevenueBreakdown(clinicId, range, 'INR'),
        buildPatientBreakdown(clinicId, range),
        analyticsRepository.waitingTimeStats({ clinicId, start: range.start, end: range.end }),
        this.getDoctorPerformance(userId, role, clinicId, rangeQuery),
      ]);
      const utilizations = doctorRows.rows.map((r) => r.utilization).filter((u): u is number => u !== null);
      rows.push({
        clinicId,
        clinicName: clinic.name,
        appointments: appointments.total,
        completed: appointments.completed,
        cancelled: appointments.cancelled,
        revenue: revenue.grossCollected,
        patients: patients.totalPatientsServed,
        averageWaitingMinutes: roundOrNull(waiting.avg_minutes),
        averageDoctorUtilization: utilizations.length ? roundOrNull(utilizations.reduce((a, b) => a + b, 0) / utilizations.length, 4) : null,
      });
    }
    return { range: toResolvedDateRangeDto(range), rows };
  },
};

function emptyRevenue(currency: string): RevenueBreakdownDto {
  return {
    currency,
    grossCollected: 0,
    refundedAmount: 0,
    netCollected: 0,
    pendingAmount: 0,
    failedAmount: 0,
    successfulPaymentCount: 0,
    pendingPaymentCount: 0,
    failedPaymentCount: 0,
    refundedCount: 0,
    averageTransactionValue: null,
  };
}

/** The overview endpoint quietly omits revenue figures (rather than 403ing the whole request) for
 * a caller who has ANALYTICS_VIEW but not ANALYTICS_REVENUE_VIEW — matches spec section 23's
 * "operational analytics allowed by existing permissions" for staff who aren't billing-authorized. */
async function hasRevenueAccess(userId: string, role: UserRole, clinicId: string): Promise<boolean> {
  try {
    await assertClinicAnalyticsAccess(userId, role, clinicId, CLINIC_PERMISSIONS.ANALYTICS_REVENUE_VIEW);
    return true;
  } catch {
    return false;
  }
}
