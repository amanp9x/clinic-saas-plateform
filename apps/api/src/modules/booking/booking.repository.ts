import type { BookingSource, ConsultationType, Weekday } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { isUniqueConstraintError } from '../doctor-queue/queue.repository.js';
import { ConflictError } from '../../utils/app-error.js';

const HOLD_MINUTES_DEFAULT = 5;
/** Short internal hold window used by the direct-booking fast path (reception "Add appointment",
 * or a patient skipping the explicit hold step) — irrelevant to the caller, just long enough to
 * cover the single request's own processing time before the hold is immediately confirmed. */
const HOLD_MINUTES_INTERNAL = 1;

export { HOLD_MINUTES_DEFAULT, HOLD_MINUTES_INTERNAL };

export interface ClaimSlotInput {
  doctorId: string;
  clinicId: string;
  scheduledAt: Date;
  durationMinutes: number;
  patientId: string;
  heldByUserId: string;
  bookingSource: BookingSource;
  consultationType: ConsultationType;
  holdMinutes: number;
}

export const bookingRepository = {
  /**
   * The one atomic primitive double-booking safety is built on. Structural transplant of
   * `queue-engine.service.ts::findOrCreateSession` (optimistic create → catch P2002 → guarded
   * re-claim) fused with `queue.repository.ts::claimToken`'s `updateMany`-guard-and-count idiom
   * — the only two concurrency patterns used anywhere in this codebase. No new idiom introduced.
   *
   * `status: 'ACTIVE'` is necessary but not sufficient to treat a row as holding a slot — every
   * caller must also check `expiresAt > now()`. There is no background sweep (no job/cron
   * infrastructure exists anywhere in this codebase) — expiry is resolved lazily, only when a
   * later claim attempt reclaims the stale row.
   */
  async claimSlot(input: ClaimSlotInput) {
    const expiresAt = new Date(Date.now() + input.holdMinutes * 60_000);
    const baseData = {
      durationMinutes: input.durationMinutes,
      patientId: input.patientId,
      heldByUserId: input.heldByUserId,
      bookingSource: input.bookingSource,
      consultationType: input.consultationType,
      status: 'ACTIVE' as const,
      expiresAt,
    };

    try {
      return await prisma.slotHold.create({
        data: {
          doctorId: input.doctorId,
          clinicId: input.clinicId,
          scheduledAt: input.scheduledAt,
          ...baseData,
        },
      });
    } catch (err) {
      if (!isUniqueConstraintError(err)) throw err;

      const now = new Date();
      const claimed = await prisma.slotHold.updateMany({
        where: {
          doctorId: input.doctorId,
          clinicId: input.clinicId,
          scheduledAt: input.scheduledAt,
          OR: [{ status: 'EXPIRED' }, { status: 'RELEASED' }, { status: 'ACTIVE', expiresAt: { lt: now } }],
        },
        data: baseData,
      });
      if (claimed.count !== 1) {
        throw new ConflictError('This slot is currently held or booked by someone else');
      }
      return prisma.slotHold.findUniqueOrThrow({
        where: { doctorId_clinicId_scheduledAt: { doctorId: input.doctorId, clinicId: input.clinicId, scheduledAt: input.scheduledAt } },
      });
    }
  },

  findActiveHoldById(id: string) {
    return prisma.slotHold.findUnique({ where: { id } });
  },

  releaseHold(id: string) {
    return prisma.slotHold.update({ where: { id }, data: { status: 'RELEASED' } });
  },

  /** Idempotent: releasing an already-released/expired hold is a no-op, not an error. */
  async releaseHoldIfActive(id: string, heldByUserId: string) {
    await prisma.slotHold.updateMany({
      where: { id, heldByUserId, status: 'ACTIVE' },
      data: { status: 'RELEASED' },
    });
  },

  findAvailabilityTemplates(clinicDoctorId: string, weekday: Weekday) {
    return prisma.doctorAvailability.findMany({
      where: { clinicDoctorId, weekday, isActive: true },
      orderBy: { startTime: 'asc' },
    });
  },

  findClinicWorkingHours(clinicId: string, weekday: Weekday) {
    return prisma.clinicWorkingHours.findUnique({
      where: { clinicId_weekday: { clinicId, weekday } },
      include: { sessions: true },
    });
  },

  findClinicHoliday(clinicId: string, date: Date) {
    return prisma.clinicHoliday.findUnique({ where: { clinicId_date: { clinicId, date } } });
  },

  findDoctorLeaves(doctorId: string, clinicId: string, date: Date) {
    return prisma.doctorLeave.findMany({
      where: {
        doctorId,
        OR: [{ clinicId: null }, { clinicId }],
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });
  },

  findClinicSettings(clinicId: string) {
    return prisma.clinicSettings.findUnique({ where: { clinicId } });
  },

  findExistingAppointmentsForDay(doctorId: string, clinicId: string, dayStart: Date, dayEnd: Date) {
    return prisma.appointment.findMany({
      where: {
        doctorId,
        clinicId,
        scheduledAt: { gte: dayStart, lt: dayEnd },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      },
      select: { scheduledAt: true, durationMinutes: true },
    });
  },

  findActiveHoldsForDay(doctorId: string, clinicId: string, dayStart: Date, dayEnd: Date) {
    return prisma.slotHold.findMany({
      where: {
        doctorId,
        clinicId,
        scheduledAt: { gte: dayStart, lt: dayEnd },
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
      },
      select: { scheduledAt: true },
    });
  },

  findActiveBlocksForRange(doctorId: string, clinicId: string, rangeStart: Date, rangeEnd: Date) {
    return prisma.blockedSlot.findMany({
      where: {
        clinicId,
        isActive: true,
        startAt: { lt: rangeEnd },
        endAt: { gt: rangeStart },
        OR: [{ doctorId: null }, { doctorId }],
      },
    });
  },

  findAppointmentByIdForActor(id: string) {
    return prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: { include: { user: true } },
        doctor: { include: { specialization: true } },
        clinic: true,
        prescriptions: { select: { id: true } },
        payment: { select: { id: true, status: true } },
      },
    });
  },

  /** Phase 19 — Doctor Leave conflict resolution. `clinicId: null` means "every clinic this
   * doctor practices at" (a leave with no clinic scope), matching `DoctorLeave.clinicId`'s own
   * nullable semantics. Only `CANCELLABLE_STATUSES` are relevant here — an already-cancelled,
   * completed, or checked-in appointment is never touched. */
  findConflictingAppointments(doctorId: string, clinicId: string | null, rangeStart: Date, rangeEnd: Date) {
    return prisma.appointment.findMany({
      where: {
        doctorId,
        ...(clinicId ? { clinicId } : {}),
        scheduledAt: { gte: rangeStart, lt: rangeEnd },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      include: {
        patient: { include: { user: true } },
        doctor: { include: { specialization: true } },
        clinic: true,
        prescriptions: { select: { id: true } },
        payment: { select: { id: true, status: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  },
};
