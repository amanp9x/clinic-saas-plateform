import type { Prisma, SettlementStatus } from '@prisma/client';
import { prisma } from '../../config/database.js';

const detailInclude = {
  doctor: { select: { displayName: true } },
} satisfies Prisma.SettlementRequestInclude;

export type SettlementRequestWithRelations = Prisma.SettlementRequestGetPayload<{ include: typeof detailInclude }>;

export const settlementRepository = {
  create(data: Prisma.SettlementRequestUncheckedCreateInput) {
    return prisma.settlementRequest.create({ data, include: detailInclude });
  },

  findById(id: string) {
    return prisma.settlementRequest.findUnique({ where: { id }, include: detailInclude });
  },

  findByIdForDoctor(id: string, doctorId: string) {
    return prisma.settlementRequest.findFirst({ where: { id, doctorId }, include: detailInclude });
  },

  async listForDoctor(doctorId: string, filters: { status?: SettlementStatus }, page: number, limit: number) {
    const where: Prisma.SettlementRequestWhereInput = { doctorId, ...filters };
    const [items, total] = await Promise.all([
      prisma.settlementRequest.findMany({ where, include: detailInclude, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.settlementRequest.count({ where }),
    ]);
    return { items, total };
  },

  async listForPlatform(filters: { status?: SettlementStatus }, page: number, limit: number) {
    const where: Prisma.SettlementRequestWhereInput = { ...filters };
    const [items, total] = await Promise.all([
      prisma.settlementRequest.findMany({ where, include: detailInclude, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.settlementRequest.count({ where }),
    ]);
    return { items, total };
  },

  /** Atomic claim: only succeeds if the row is still in the exact status the caller last read, so
   * two concurrent admin decisions (or an admin action racing another tick) on the same request
   * can never both apply — the same updateMany-guard-and-count idiom used by prescription-refill,
   * contact-message triage, and staff-invitation expiry. */
  async claimTransition(
    id: string,
    expectedStatus: SettlementStatus,
    data: { status: SettlementStatus; respondedByUserId: string; reviewNotes: string | null; paidAt?: Date },
  ): Promise<number> {
    const result = await prisma.settlementRequest.updateMany({
      where: { id, status: expectedStatus },
      data: { status: data.status, respondedByUserId: data.respondedByUserId, respondedAt: new Date(), reviewNotes: data.reviewNotes, paidAt: data.paidAt },
    });
    return result.count;
  },
};
