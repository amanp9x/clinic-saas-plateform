import type { Prisma, RefundRequestStatus } from '@prisma/client';
import { prisma } from '../../config/database.js';

const detailInclude = {
  patient: { select: { fullName: true, userId: true } },
  clinic: { select: { name: true } },
  payment: { select: { appointmentId: true, appointment: { select: { bookingReference: true } } } },
} satisfies Prisma.RefundRequestInclude;

export type RefundRequestWithRelations = Prisma.RefundRequestGetPayload<{ include: typeof detailInclude }>;

export const refundRequestRepository = {
  /** Relies on the hand-added partial unique index (`refund_requests_payment_active_key`, active
   * only while status=REQUESTED) as the real, atomic "at most one active request per payment"
   * guard — no separate pre-check SELECT, same convention as settlement/slot-hold claims. Callers
   * catch the unique-constraint violation and convert it to a ConflictError. */
  create(data: Prisma.RefundRequestUncheckedCreateInput) {
    return prisma.refundRequest.create({ data, include: detailInclude });
  },

  findById(id: string) {
    return prisma.refundRequest.findUnique({ where: { id }, include: detailInclude });
  },

  findByIdForPatient(id: string, patientId: string) {
    return prisma.refundRequest.findFirst({ where: { id, patientId }, include: detailInclude });
  },

  async listForClinic(clinicId: string, filters: { status?: RefundRequestStatus }, page: number, limit: number) {
    const where: Prisma.RefundRequestWhereInput = { clinicId, ...filters };
    const [items, total] = await Promise.all([
      prisma.refundRequest.findMany({ where, include: detailInclude, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.refundRequest.count({ where }),
    ]);
    return { items, total };
  },

  /** Atomic claim: only succeeds if the row is still REQUESTED, so two concurrent staff decisions
   * (or an approve racing a reject) on the same request can never both apply — the same
   * updateMany-guard-and-count idiom used by settlement requests, refill requests, and
   * contact-message triage. */
  async claimTransition(id: string, data: { status: RefundRequestStatus; respondedByUserId: string; reviewNotes: string | null }): Promise<number> {
    const result = await prisma.refundRequest.updateMany({
      where: { id, status: 'REQUESTED' },
      data: { status: data.status, respondedByUserId: data.respondedByUserId, respondedAt: new Date(), reviewNotes: data.reviewNotes },
    });
    return result.count;
  },

  /** Reverts a claimed-but-failed approval back to REQUESTED so the request can be retried later —
   * mirrors `performRefund`'s own rollback-on-failure behavior at the Payment level (Do NOT leave
   * this falsely APPROVED if the underlying refund attempt failed). Safe without its own atomic
   * guard: only ever called immediately after this same call stack's own successful claim, so
   * nothing else can have touched the row in between. */
  revertToRequested(id: string) {
    return prisma.refundRequest.update({
      where: { id },
      data: { status: 'REQUESTED', respondedByUserId: null, respondedAt: null, reviewNotes: null },
    });
  },

  /** Same fan-out precedent already used for clinic-verification notifications
   * (`platform-admin.repository.ts::clinicAdminUserIds`) — a new refund request notifies the
   * clinic's admins, not every staff member who happens to hold PAYMENT_REFUND. */
  clinicAdminUserIds(clinicId: string) {
    return prisma.clinicStaffMember.findMany({
      where: { clinicId, isActive: true, user: { role: 'CLINIC_ADMIN' } },
      select: { userId: true },
    });
  },
};
