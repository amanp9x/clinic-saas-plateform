import { UserRole } from '@clinic/shared';
import { prisma } from '../../config/database.js';
import { identifierType } from '../../utils/identifier.js';

export const authRepository = {
  findUserByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  findUserByPhone(phone: string) {
    return prisma.user.findUnique({ where: { phone } });
  },

  findUserByIdentifier(identifier: string) {
    return identifierType(identifier) === 'email'
      ? prisma.user.findUnique({ where: { email: identifier } })
      : prisma.user.findUnique({ where: { phone: identifier } });
  },

  findUserById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  async createPatientUser(input: {
    email: string;
    passwordHash: string;
    fullName: string;
    phone?: string;
  }) {
    return prisma.user.create({
      data: {
        email: input.email,
        phone: input.phone,
        passwordHash: input.passwordHash,
        role: UserRole.PATIENT,
        patientProfile: { create: { fullName: input.fullName } },
      },
    });
  },

  /** Auto-provisioned by a successful OTP login for an identifier with no existing account. */
  async createPatientUserFromOtp(identifier: string) {
    const type = identifierType(identifier);
    return prisma.user.create({
      data: {
        email: type === 'email' ? identifier : undefined,
        phone: type === 'phone' ? identifier : undefined,
        role: UserRole.PATIENT,
        isEmailVerified: type === 'email',
        isMobileVerified: type === 'phone',
        patientProfile: { create: { fullName: 'New Patient' } },
      },
    });
  },

  updateLastLogin(userId: string) {
    return prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  },

  updatePasswordHash(userId: string, passwordHash: string) {
    return prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  },

  markEmailVerified(userId: string) {
    return prisma.user.update({ where: { id: userId }, data: { isEmailVerified: true } });
  },

  markMobileVerified(userId: string) {
    return prisma.user.update({ where: { id: userId }, data: { isMobileVerified: true } });
  },

  async recordFailedLogin(userId: string, maxAttempts: number, lockoutMinutes: number) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
    });

    if (user.failedLoginAttempts >= maxAttempts) {
      await prisma.user.update({
        where: { id: userId },
        data: { lockedUntil: new Date(Date.now() + lockoutMinutes * 60_000) },
      });
    }
  },

  resetFailedLogin(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  },
};
