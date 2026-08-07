import { prisma } from '../../config/database.js';

interface CreateSessionInput {
  id: string;
  userId: string;
  userAgent?: string;
  ipAddress?: string;
  deviceLabel: string | null;
  sessionExpiresAt: Date;
  tokenHash: string;
  tokenExpiresAt: Date;
}

export const sessionRepository = {
  async create(input: CreateSessionInput) {
    return prisma.session.create({
      data: {
        id: input.id,
        userId: input.userId,
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
        deviceLabel: input.deviceLabel,
        expiresAt: input.sessionExpiresAt,
        refreshToken: {
          create: { tokenHash: input.tokenHash, expiresAt: input.tokenExpiresAt },
        },
      },
    });
  },

  findActiveWithToken(sessionId: string) {
    return prisma.session.findFirst({
      where: { id: sessionId, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { refreshToken: true },
    });
  },

  async rotateToken(
    sessionId: string,
    input: {
      tokenHash: string;
      tokenExpiresAt: Date;
      sessionExpiresAt: Date;
      userAgent?: string;
      ipAddress?: string;
    },
  ) {
    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { sessionId },
        data: { tokenHash: input.tokenHash, expiresAt: input.tokenExpiresAt },
      }),
      prisma.session.update({
        where: { id: sessionId },
        data: {
          lastUsedAt: new Date(),
          expiresAt: input.sessionExpiresAt,
          // Track the most recent device/IP seen for this session (useful signal for the
          // sessions UI and for spotting suspicious mid-session IP changes later).
          userAgent: input.userAgent,
          ipAddress: input.ipAddress,
        },
      }),
    ]);
  },

  revoke(sessionId: string, reason: string) {
    return prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  },

  revokeOwnedByUser(sessionId: string, userId: string, reason: string) {
    return prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  },

  revokeAllForUser(userId: string, reason: string, exceptSessionId?: string) {
    return prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  },

  listActiveForUser(userId: string) {
    return prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });
  },
};
