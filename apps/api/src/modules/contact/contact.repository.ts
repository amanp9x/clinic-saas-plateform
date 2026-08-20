import type { ContactMessageStatus, Prisma } from '@prisma/client';
import type { ContactMessageInput } from '@clinic/shared';
import { prisma } from '../../config/database.js';

export const contactRepository = {
  create(input: ContactMessageInput) {
    return prisma.contactMessage.create({ data: input });
  },

  findById(id: string) {
    return prisma.contactMessage.findUnique({ where: { id } });
  },

  async listForAdmin(filters: { status?: ContactMessageStatus; search?: string }, page: number, limit: number) {
    const where: Prisma.ContactMessageWhereInput = {
      status: filters.status,
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' } },
              { email: { contains: filters.search, mode: 'insensitive' } },
              { subject: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.contactMessage.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.contactMessage.count({ where }),
    ]);
    return { items, total };
  },

  /** Atomic claim: only succeeds if the row is still in the exact status the caller last read, so
   * two admins racing a status transition on the same message can never both proceed — the same
   * updateMany-guard-and-count idiom as prescription-refill's claimForResponse. This matters here
   * specifically because a successful RESOLVED transition can trigger a real outbound email; the
   * claim guarantees that email is sent at most once. */
  async claimStatusTransition(
    id: string,
    expectedStatus: ContactMessageStatus,
    data: { status: ContactMessageStatus; adminReply: string | null; respondedByUserId: string },
  ): Promise<number> {
    const result = await prisma.contactMessage.updateMany({
      where: { id, status: expectedStatus },
      data: { status: data.status, adminReply: data.adminReply, respondedAt: new Date(), respondedByUserId: data.respondedByUserId },
    });
    return result.count;
  },
};
