import type { ConsultationType, Prisma, WaitlistStatus } from '@prisma/client';
import { prisma } from '../../config/database.js';

const entryInclude = {
  doctor: { select: { id: true, displayName: true, slug: true } },
  clinic: { select: { id: true, name: true } },
} satisfies Prisma.WaitlistEntryInclude;

const clinicRowInclude = {
  patient: { select: { id: true, fullName: true, user: { select: { phone: true } } } },
  doctor: { select: { id: true, displayName: true } },
} satisfies Prisma.WaitlistEntryInclude;

const doctorRowInclude = {
  clinic: { select: { id: true, name: true } },
} satisfies Prisma.WaitlistEntryInclude;

export type WaitlistEntryWithRelations = Prisma.WaitlistEntryGetPayload<{ include: typeof entryInclude }>;
export type ClinicWaitlistRowWithRelations = Prisma.WaitlistEntryGetPayload<{ include: typeof clinicRowInclude }>;
export type DoctorWaitlistRowWithRelations = Prisma.WaitlistEntryGetPayload<{ include: typeof doctorRowInclude }>;

const ACTIVE_OR_NOTIFIED: WaitlistStatus[] = ['ACTIVE', 'NOTIFIED'];

export const waitlistRepository = {
  create(data: {
    patientId: string;
    doctorId: string;
    clinicId: string;
    targetDate: Date;
    consultationType?: ConsultationType;
    notes?: string;
    createdByUserId: string;
  }) {
    return prisma.waitlistEntry.create({ data, include: entryInclude });
  },

  findByIdForPatient(id: string, patientId: string) {
    return prisma.waitlistEntry.findFirst({ where: { id, patientId }, include: entryInclude });
  },

  findByIdForClinic(id: string, clinicId: string) {
    return prisma.waitlistEntry.findFirst({ where: { id, clinicId }, include: clinicRowInclude });
  },

  async listForPatient(patientId: string, filters: { status?: WaitlistStatus; page: number; limit: number }) {
    const where: Prisma.WaitlistEntryWhereInput = { patientId, status: filters.status };
    const [items, total] = await Promise.all([
      prisma.waitlistEntry.findMany({
        where,
        include: entryInclude,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.waitlistEntry.count({ where }),
    ]);
    return { items, total };
  },

  async listForClinic(clinicId: string, filters: { doctorId?: string; status?: WaitlistStatus; page: number; limit: number }) {
    const where: Prisma.WaitlistEntryWhereInput = { clinicId, doctorId: filters.doctorId, status: filters.status };
    const [items, total] = await Promise.all([
      prisma.waitlistEntry.findMany({
        where,
        include: clinicRowInclude,
        orderBy: { createdAt: 'asc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.waitlistEntry.count({ where }),
    ]);
    return { items, total };
  },

  async listForDoctor(doctorId: string, filters: { clinicId?: string; page: number; limit: number }) {
    const where: Prisma.WaitlistEntryWhereInput = { doctorId, clinicId: filters.clinicId, status: { in: ACTIVE_OR_NOTIFIED } };
    const [items, total] = await Promise.all([
      prisma.waitlistEntry.findMany({
        where,
        include: doctorRowInclude,
        orderBy: { targetDate: 'asc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.waitlistEntry.count({ where }),
    ]);
    return { items, total };
  },

  /** Guarded cancel — only ACTIVE/NOTIFIED entries can be cancelled. `count === 0` means either
   * the entry doesn't exist/isn't owned by `extraWhere`, or it exists but is already
   * CANCELLED/FULFILLED; callers distinguish those with a follow-up existence check. */
  cancel(id: string, extraWhere: Prisma.WaitlistEntryWhereInput, cancelledByUserId: string) {
    return prisma.waitlistEntry.updateMany({
      where: { id, ...extraWhere, status: { in: ACTIVE_OR_NOTIFIED } },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledByUserId },
    });
  },

  /** Every ACTIVE/NOTIFIED entry for this doctor+clinic+date — called when a slot on that date
   * frees up (cancellation/no-show/reschedule-away). Includes the patient's userId for
   * notification dispatch. */
  findMatchingForFreedSlot(doctorId: string, clinicId: string, targetDate: Date) {
    return prisma.waitlistEntry.findMany({
      where: { doctorId, clinicId, targetDate, status: { in: ACTIVE_OR_NOTIFIED } },
      include: {
        patient: { select: { userId: true } },
        doctor: { select: { displayName: true } },
        clinic: { select: { name: true } },
      },
    });
  },

  /** Best-effort informational transition — the real "don't double-notify" guarantee is the
   * notification dispatch pipeline's own idempotency key, not this flag (see waitlist.notify.ts). */
  markNotified(ids: string[]) {
    return prisma.waitlistEntry.updateMany({
      where: { id: { in: ids }, status: 'ACTIVE' },
      data: { status: 'NOTIFIED', notifiedAt: new Date() },
    });
  },

  /** The (at most one, enforced by the partial unique index) ACTIVE/NOTIFIED entry this patient
   * has for this doctor+clinic+date — called right after a successful booking/reschedule to see
   * whether it just satisfied a standing waitlist request. */
  findMatchingForFulfillment(patientId: string, doctorId: string, clinicId: string, targetDate: Date) {
    return prisma.waitlistEntry.findFirst({
      where: { patientId, doctorId, clinicId, targetDate, status: { in: ACTIVE_OR_NOTIFIED } },
    });
  },

  markFulfilled(id: string, appointmentId: string) {
    return prisma.waitlistEntry.updateMany({
      where: { id, status: { in: ACTIVE_OR_NOTIFIED } },
      data: { status: 'FULFILLED', fulfilledAppointmentId: appointmentId },
    });
  },

  activeCountForClinic(clinicId: string) {
    return prisma.waitlistEntry.count({ where: { clinicId, status: { in: ACTIVE_OR_NOTIFIED } } });
  },
};
