import { AppointmentStatus, type PaymentMethod, type PaymentTransactionStatus } from '@prisma/client';
import { prisma } from '../../config/database.js';

const CAPTURED_LIKE_STATUSES: PaymentTransactionStatus[] = ['CAPTURED', 'PARTIALLY_REFUNDED'];
const PENDING_STATUSES: PaymentTransactionStatus[] = ['CREATED', 'PENDING', 'AUTHORIZED'];
const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
  AppointmentStatus.IN_CONSULTATION,
  AppointmentStatus.COMPLETED,
];

interface RangeFilter {
  clinicId: string;
  start: Date;
  end: Date;
  doctorId?: string;
}

export const analyticsRepository = {
  async appointmentStatusCounts({ clinicId, start, end, doctorId }: RangeFilter) {
    const rows = await prisma.appointment.groupBy({
      by: ['status'],
      where: { clinicId, doctorId, scheduledAt: { gte: start, lt: end } },
      _count: { _all: true },
    });
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.status] = r._count._all;
    return counts;
  },

  async rescheduledCount({ clinicId, start, end, doctorId }: RangeFilter) {
    return prisma.appointment.count({
      where: { clinicId, doctorId, scheduledAt: { gte: start, lt: end }, rescheduleCount: { gt: 0 } },
    });
  },

  /** Day/week/month appointment trend. Postgres `date_trunc` is used because Prisma's query
   * builder has no date-bucketing primitive — this keeps the bucketing in the database instead of
   * fetching every row and truncating in Node (spec section 26). */
  async appointmentTrend({ clinicId, start, end, doctorId }: RangeFilter, granularity: 'day' | 'week' | 'month') {
    return prisma.$queryRaw<Array<{ bucket: Date; count: bigint }>>`
      SELECT date_trunc(${granularity}, "scheduledAt") AS bucket, COUNT(*)::bigint AS count
      FROM "appointments"
      WHERE "clinicId" = ${clinicId}
        AND "scheduledAt" >= ${start} AND "scheduledAt" < ${end}
        AND (${doctorId ?? null}::text IS NULL OR "doctorId" = ${doctorId ?? null})
      GROUP BY bucket
      ORDER BY bucket ASC
    `;
  },

  /** Gross collected / refunded / net, scoped by `capturedAt` (revenue is recognized when a
   * payment is captured, not when the order was created) — see analytics.service.ts for the full
   * documented formula. Deliberately mirrors the status set already used by
   * `payment.repository.ts::clinicBillingTotals` (CAPTURED + PARTIALLY_REFUNDED = "collected") so
   * this module doesn't invent a second, conflicting definition of "collected revenue". */
  async revenueTotals({ clinicId, start, end, doctorId }: RangeFilter) {
    const [captured, pending, failed] = await Promise.all([
      prisma.payment.aggregate({
        where: { clinicId, doctorId, status: { in: CAPTURED_LIKE_STATUSES }, capturedAt: { gte: start, lt: end } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { clinicId, doctorId, status: { in: PENDING_STATUSES }, createdAt: { gte: start, lt: end } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { clinicId, doctorId, status: 'FAILED', updatedAt: { gte: start, lt: end } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);
    return {
      grossCollected: Number(captured._sum.amount ?? 0),
      successfulPaymentCount: captured._count,
      pendingAmount: Number(pending._sum.amount ?? 0),
      pendingPaymentCount: pending._count,
      failedAmount: Number(failed._sum.amount ?? 0),
      failedPaymentCount: failed._count,
    };
  },

  /** Refund figures are scoped by the Refund row's own `createdAt` (when the refund happened),
   * deliberately a different date axis from `revenueTotals`' `capturedAt` — this is standard
   * financial reporting (recognize revenue when captured, recognize its reversal when refunded),
   * not a bug. See analytics.service.ts's revenue formula documentation. */
  async refundTotals({ clinicId, start, end, doctorId }: RangeFilter) {
    const result = await prisma.refund.aggregate({
      where: {
        status: { in: ['REFUNDED', 'PARTIALLY_REFUNDED'] },
        createdAt: { gte: start, lt: end },
        payment: { clinicId, doctorId },
      },
      _sum: { amount: true },
      _count: true,
    });
    return { refundedAmount: Number(result._sum.amount ?? 0), refundedCount: result._count };
  },

  async revenueByProvider({ clinicId, start, end, doctorId }: RangeFilter) {
    const rows = await prisma.payment.groupBy({
      by: ['provider'],
      where: { clinicId, doctorId, status: { in: CAPTURED_LIKE_STATUSES }, capturedAt: { gte: start, lt: end } },
      _sum: { amount: true },
      _count: { _all: true },
    });
    return rows.map((r) => ({ provider: r.provider, count: r._count._all, amount: Number(r._sum.amount ?? 0) }));
  },

  async revenueByMethod({ clinicId, start, end, doctorId }: RangeFilter) {
    const rows = await prisma.payment.groupBy({
      by: ['method'],
      where: { clinicId, doctorId, status: { in: CAPTURED_LIKE_STATUSES }, capturedAt: { gte: start, lt: end } },
      _sum: { amount: true },
      _count: { _all: true },
    });
    return rows.map((r) => ({ method: r.method as PaymentMethod | null, count: r._count._all, amount: Number(r._sum.amount ?? 0) }));
  },

  async revenueByDoctor({ clinicId, start, end }: RangeFilter) {
    const rows = await prisma.payment.groupBy({
      by: ['doctorId'],
      where: { clinicId, status: { in: CAPTURED_LIKE_STATUSES }, capturedAt: { gte: start, lt: end } },
      _sum: { amount: true },
      _count: { _all: true },
    });
    return rows.map((r) => ({ doctorId: r.doctorId, count: r._count._all, amount: Number(r._sum.amount ?? 0) }));
  },

  async revenueByConsultationType({ clinicId, start, end }: RangeFilter) {
    const rows = await prisma.$queryRaw<Array<{ consultationtype: string; count: bigint; amount: string | null }>>`
      SELECT a."consultationType" AS consultationtype, COUNT(*)::bigint AS count, SUM(p."amount")::text AS amount
      FROM "payments" p
      JOIN "appointments" a ON a."id" = p."appointmentId"
      WHERE p."clinicId" = ${clinicId} AND p."status" IN ('CAPTURED', 'PARTIALLY_REFUNDED')
        AND p."capturedAt" >= ${start} AND p."capturedAt" < ${end}
      GROUP BY a."consultationType"
    `;
    return rows.map((r) => ({ consultationType: r.consultationtype, count: Number(r.count), amount: Number(r.amount ?? 0) }));
  },

  async revenueTrend({ clinicId, start, end, doctorId }: RangeFilter, granularity: 'day' | 'week' | 'month') {
    return prisma.$queryRaw<Array<{ bucket: Date; amount: string | null; count: bigint }>>`
      SELECT date_trunc(${granularity}, "capturedAt") AS bucket, SUM("amount")::text AS amount, COUNT(*)::bigint AS count
      FROM "payments"
      WHERE "clinicId" = ${clinicId} AND "status" IN ('CAPTURED', 'PARTIALLY_REFUNDED')
        AND "capturedAt" >= ${start} AND "capturedAt" < ${end}
        AND (${doctorId ?? null}::text IS NULL OR "doctorId" = ${doctorId ?? null})
      GROUP BY bucket
      ORDER BY bucket ASC
    `;
  },

  /** Waiting time = consultation start − check-in (QueueToken.createdAt is set exactly at
   * check-in time — see queue-engine.service.ts::checkIn). Uses Postgres `percentile_cont` for the
   * median so the database does the statistics, not a full-row fetch into Node (spec section 26).
   * `c."startedAt" >= qt."createdAt"` excludes invalid/incomplete records per spec section 12 — a
   * consultation cannot legitimately start before its patient checked in, so any row where that
   * happens (e.g. hand-authored/backdated data) is a corrupt sample, not a real negative wait. */
  async waitingTimeStats({ clinicId, start, end, doctorId }: RangeFilter) {
    const rows = await prisma.$queryRaw<Array<{ avg_minutes: number | null; median_minutes: number | null; max_minutes: number | null; sample_count: bigint }>>`
      SELECT
        AVG(EXTRACT(EPOCH FROM (c."startedAt" - qt."createdAt")) / 60)::float AS avg_minutes,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (c."startedAt" - qt."createdAt")) / 60)::float AS median_minutes,
        MAX(EXTRACT(EPOCH FROM (c."startedAt" - qt."createdAt")) / 60)::float AS max_minutes,
        COUNT(*)::bigint AS sample_count
      FROM "queue_tokens" qt
      JOIN "doctor_sessions" ds ON ds.id = qt."doctorSessionId"
      JOIN "consultations" c ON c."tokenId" = qt.id
      WHERE ds."clinicId" = ${clinicId}
        AND qt."createdAt" >= ${start} AND qt."createdAt" < ${end}
        AND c."startedAt" IS NOT NULL
        AND c."startedAt" >= qt."createdAt"
        AND (${doctorId ?? null}::text IS NULL OR ds."doctorId" = ${doctorId ?? null})
    `;
    return rows[0] ?? { avg_minutes: null, median_minutes: null, max_minutes: null, sample_count: 0n };
  },

  async queueTokenCounts({ clinicId, start, end, doctorId }: RangeFilter) {
    const rows = await prisma.queueToken.groupBy({
      by: ['status'],
      where: { doctorSession: { clinicId, doctorId }, createdAt: { gte: start, lt: end } },
      _count: { _all: true },
    });
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.status] = r._count._all;
    return counts;
  },

  async checkedInCount({ clinicId, start, end, doctorId }: RangeFilter) {
    return prisma.queueToken.count({ where: { doctorSession: { clinicId, doctorId }, createdAt: { gte: start, lt: end } } });
  },

  async calledCount({ clinicId, start, end, doctorId }: RangeFilter) {
    return prisma.queueToken.count({ where: { doctorSession: { clinicId, doctorId }, calledAt: { gte: start, lt: end } } });
  },

  /** Average consultation duration, doctor sessions in range for delay stats' session universe. */
  /** `c."completedAt" >= c."startedAt"` — same invalid-record exclusion as waitingTimeStats above;
   * a consultation cannot legitimately complete before it started. */
  async consultationDurationStats({ clinicId, start, end, doctorId }: RangeFilter) {
    const result = await prisma.$queryRaw<Array<{ avg_minutes: number | null }>>`
      SELECT AVG(EXTRACT(EPOCH FROM (c."completedAt" - c."startedAt")) / 60)::float AS avg_minutes
      FROM "consultations" c
      WHERE c."clinicId" = ${clinicId}
        AND c."completedAt" IS NOT NULL AND c."startedAt" IS NOT NULL
        AND c."completedAt" >= c."startedAt"
        AND c."completedAt" >= ${start} AND c."completedAt" < ${end}
        AND (${doctorId ?? null}::text IS NULL OR c."doctorId" = ${doctorId ?? null})
    `;
    return result[0]?.avg_minutes ?? null;
  },

  /** Delay figures come from the existing `queue.delay_updated` audit trail (every delay change is
   * already logged by queue.service.ts::updateDelay) rather than a new tracking table — spec
   * section 13 explicitly prefers this over duplicating delay tracking. `metadata` is JSON, so the
   * numeric comparison/aggregation needs a raw query. */
  async delayAuditStats({ clinicId, start, end, doctorId }: RangeFilter) {
    const rows = await prisma.$queryRaw<Array<{ doctor_id: string; delayed_sessions: bigint; avg_delay: number | null; max_delay: number | null }>>`
      SELECT
        metadata->>'doctorId' AS doctor_id,
        COUNT(DISTINCT "entityId")::bigint AS delayed_sessions,
        AVG((metadata->>'delayMinutes')::numeric)::float AS avg_delay,
        MAX((metadata->>'delayMinutes')::numeric)::float AS max_delay
      FROM "audit_logs"
      WHERE action = 'queue.delay_updated' AND "clinicId" = ${clinicId}
        AND "createdAt" >= ${start} AND "createdAt" < ${end}
        AND (metadata->>'delayMinutes')::numeric > 0
        AND (${doctorId ?? null}::text IS NULL OR metadata->>'doctorId' = ${doctorId ?? null})
      GROUP BY metadata->>'doctorId'
    `;
    return rows.map((r) => ({ doctorId: r.doctor_id, delayedSessions: Number(r.delayed_sessions), averageDelayMinutes: r.avg_delay, maximumDelayMinutes: r.max_delay }));
  },

  /** Patients with at least one appointment in range, plus each such patient's true first-ever
   * appointment date at this clinic (not date-range-scoped) so new-vs-returning can be derived —
   * see analytics.service.ts for the classification. Two bounded queries, never a full table scan. */
  async patientFirstVisitForRangePatients({ clinicId, start, end }: RangeFilter) {
    const inRange = await prisma.appointment.findMany({
      where: { clinicId, scheduledAt: { gte: start, lt: end }, status: { in: ACTIVE_APPOINTMENT_STATUSES } },
      distinct: ['patientId'],
      select: { patientId: true },
    });
    const patientIds = inRange.map((r) => r.patientId);
    if (patientIds.length === 0) return [];
    const firstVisits = await prisma.appointment.groupBy({
      by: ['patientId'],
      where: { clinicId, patientId: { in: patientIds }, status: { in: ACTIVE_APPOINTMENT_STATUSES } },
      _min: { scheduledAt: true },
    });
    return firstVisits.map((f) => ({ patientId: f.patientId, firstVisitAt: f._min.scheduledAt! }));
  },

  async appointmentsPerPatient({ clinicId, start, end }: RangeFilter) {
    const rows = await prisma.appointment.groupBy({
      by: ['patientId'],
      where: { clinicId, scheduledAt: { gte: start, lt: end } },
      _count: { _all: true },
    });
    return rows.map((r) => ({ patientId: r.patientId, count: r._count._all }));
  },

  async doctorsForClinic(clinicId: string, doctorId?: string) {
    return prisma.clinicDoctor.findMany({
      where: { clinicId, status: 'ACTIVE', doctorId },
      include: { doctor: { select: { id: true, displayName: true, ratingAverage: true, ratingCount: true } } },
    });
  },

  async reviewCountInRange(doctorId: string, start: Date, end: Date) {
    // PUBLISHED only (Phase 12) — kept consistent with Doctor.ratingAverage, which is likewise a
    // published-only aggregate; an unpublished/hidden review must never inflate this count.
    return prisma.doctorReview.count({ where: { doctorId, status: 'PUBLISHED', createdAt: { gte: start, lt: end } } });
  },

  /** Clinic-wide review summary (Phase 12 extension) — averages the clinic's own ClinicReview
   * aggregate with the mean of its doctors' ratingAverage, both already published-only caches. */
  async clinicReviewSummary(clinicId: string) {
    const [clinicAgg, doctorRows] = await Promise.all([
      prisma.clinicReview.aggregate({ where: { clinicId, status: 'PUBLISHED' }, _avg: { rating: true }, _count: true }),
      prisma.clinicDoctor.findMany({ where: { clinicId, status: 'ACTIVE' }, select: { doctor: { select: { ratingAverage: true, ratingCount: true } } } }),
    ]);
    const doctorRatings = doctorRows.map((d) => d.doctor.ratingAverage).filter((r): r is number => r !== null);
    const doctorReviewCount = doctorRows.reduce((sum, d) => sum + d.doctor.ratingCount, 0);
    return {
      clinicAverageRating: clinicAgg._avg.rating,
      clinicReviewCount: clinicAgg._count,
      doctorAverageRating: doctorRatings.length ? doctorRatings.reduce((a, b) => a + b, 0) / doctorRatings.length : null,
      doctorReviewCount,
    };
  },

  /** Phase 13 extension — a live snapshot (ACTIVE+NOTIFIED, not range-filtered), reusing
   * WaitlistEntry as the sole source of truth rather than a duplicate reporting table. */
  async waitlistActiveCount(clinicId: string) {
    return prisma.waitlistEntry.count({ where: { clinicId, status: { in: ['ACTIVE', 'NOTIFIED'] } } });
  },

  async doctorAvailabilityTemplates(clinicDoctorId: string) {
    return prisma.doctorAvailability.findMany({ where: { clinicDoctorId, isActive: true } });
  },

  /** A ±1 day safety margin on the pre-filter absorbs the local-midnight-vs-UTC-midnight
   * discrepancy between `start`/`end` (local midnight, from resolveDateRange) and
   * `DoctorLeave.startDate`/`endDate` (`@db.Date`, always UTC-midnight) — the precise per-day
   * inclusion decision happens in doctor-utilization.util.ts's UTC-normalized comparison, so this
   * only needs to avoid excluding a row that the precise check would otherwise correctly count. */
  async doctorLeavesInRange(doctorId: string, clinicId: string, start: Date, end: Date) {
    const marginStart = new Date(start.getTime() - 86_400_000);
    const marginEnd = new Date(end.getTime() + 86_400_000);
    return prisma.doctorLeave.findMany({
      where: { doctorId, OR: [{ clinicId: null }, { clinicId }], startDate: { lt: marginEnd }, endDate: { gte: marginStart } },
    });
  },

  async bookedMinutes({ clinicId, start, end, doctorId }: RangeFilter) {
    const result = await prisma.appointment.aggregate({
      where: { clinicId, doctorId, scheduledAt: { gte: start, lt: end }, status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
      _sum: { durationMinutes: true },
    });
    return result._sum.durationMinutes ?? 0;
  },

  async doctorSessionsInRange({ clinicId, start, end, doctorId }: RangeFilter) {
    return prisma.doctorSession.findMany({
      where: { clinicId, doctorId, sessionDate: { gte: start, lt: end } },
      include: { doctor: { select: { id: true, displayName: true } } },
    });
  },

  async queueTokensForSession(doctorSessionId: string) {
    return prisma.queueToken.findMany({
      where: { doctorSessionId },
      select: { status: true, createdAt: true, calledAt: true, completedAt: true },
    });
  },

  async appointmentReportRows(filter: RangeFilter & { status?: AppointmentStatus; consultationType?: string }, page: number, limit: number, sortDir: 'asc' | 'desc') {
    const where = {
      clinicId: filter.clinicId,
      doctorId: filter.doctorId,
      scheduledAt: { gte: filter.start, lt: filter.end },
      status: filter.status,
      consultationType: filter.consultationType as never,
    };
    const [total, items] = await Promise.all([
      prisma.appointment.count({ where }),
      prisma.appointment.findMany({
        where,
        orderBy: { scheduledAt: sortDir },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          bookingReference: true,
          scheduledAt: true,
          status: true,
          consultationType: true,
          completedAt: true,
          patient: { select: { fullName: true } },
          doctor: { select: { displayName: true } },
          queueToken: { select: { createdAt: true } },
        },
      }),
    ]);
    return { total, items };
  },

  async revenueReportRows(filter: RangeFilter & { status?: PaymentTransactionStatus }, page: number, limit: number, sortDir: 'asc' | 'desc') {
    const where = {
      clinicId: filter.clinicId,
      doctorId: filter.doctorId,
      createdAt: { gte: filter.start, lt: filter.end },
      status: filter.status,
    };
    const [total, items] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: sortDir },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          status: true,
          amount: true,
          currency: true,
          method: true,
          capturedAt: true,
          appointment: { select: { bookingReference: true } },
          patient: { select: { fullName: true } },
          doctor: { select: { displayName: true } },
        },
      }),
    ]);
    return { total, items };
  },

  /** Grouped by patient within the (date-bounded) range — inherently capped to the clinic's
   * distinct patients seen in that window, not an unbounded table scan. Sorted/paginated in Node
   * because Prisma's `groupBy` cannot `orderBy` an aggregate of the same field it grouped by. */
  async patientReportRows(clinicId: string, start: Date, end: Date, page: number, limit: number) {
    const grouped = await prisma.appointment.groupBy({
      by: ['patientId'],
      where: { clinicId, scheduledAt: { gte: start, lt: end } },
      _count: { _all: true },
    });
    grouped.sort((a, b) => b._count._all - a._count._all);
    const total = grouped.length;
    const page_ = grouped.slice((page - 1) * limit, (page - 1) * limit + limit);
    const patientIds = page_.map((g) => g.patientId);
    const [patients, statusRows, firstVisits] = await Promise.all([
      prisma.patient.findMany({ where: { id: { in: patientIds } }, select: { id: true, fullName: true } }),
      prisma.appointment.groupBy({ by: ['patientId', 'status'], where: { clinicId, patientId: { in: patientIds }, scheduledAt: { gte: start, lt: end } }, _count: { _all: true } }),
      prisma.appointment.groupBy({ by: ['patientId'], where: { clinicId, patientId: { in: patientIds } }, _min: { scheduledAt: true } }),
    ]);
    return { total, grouped: page_, patients, statusRows, firstVisits };
  },
};
