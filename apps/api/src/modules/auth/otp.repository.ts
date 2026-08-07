import type { OtpPurpose } from '@prisma/client';
import { prisma } from '../../config/database.js';

export const otpRepository = {
  countRecent(identifier: string, purpose: OtpPurpose, since: Date) {
    return prisma.otpCode.count({
      where: { identifier, purpose, createdAt: { gte: since } },
    });
  },

  create(input: { identifier: string; purpose: OtpPurpose; codeHash: string; expiresAt: Date }) {
    return prisma.otpCode.create({ data: input });
  },

  findActiveLatest(identifier: string, purpose: OtpPurpose) {
    return prisma.otpCode.findFirst({
      where: { identifier, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  },

  incrementAttempts(id: string) {
    return prisma.otpCode.update({ where: { id }, data: { attempts: { increment: 1 } } });
  },

  consume(id: string) {
    return prisma.otpCode.update({ where: { id }, data: { consumedAt: new Date() } });
  },

  invalidateActive(identifier: string, purpose: OtpPurpose) {
    return prisma.otpCode.updateMany({
      where: { identifier, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  },
};
