import { OtpPurpose } from '@prisma/client';
import type { AuthTokens } from '@clinic/shared';
import { authRepository } from './auth.repository.js';
import { otpService } from './otp.service.js';
import { sessionService, type RequestContext } from './session.service.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import {
  ConflictError,
  ForbiddenError,
  InvalidCredentialsError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';
import { env } from '../../config/env.js';
import { identifierType } from '../../utils/identifier.js';
import { notifyUser } from '../notifications/notification-dispatch.service.js';
import { securityLoginEmail } from '../notifications/email/templates.js';
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from '@clinic/shared';

type UserRecord = NonNullable<Awaited<ReturnType<typeof authRepository.findUserById>>>;

export const authService = {
  async register(input: RegisterInput, ctx: RequestContext) {
    const existing = await authRepository.findUserByEmail(input.email);
    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }
    if (input.phone) {
      const existingPhone = await authRepository.findUserByPhone(input.phone);
      if (existingPhone) {
        throw new ConflictError('An account with this phone number already exists');
      }
    }

    const passwordHash = await hashPassword(input.password);
    const user = await authRepository.createPatientUser({
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      phone: input.phone,
    });

    await otpService.request(input.email, OtpPurpose.EMAIL_VERIFICATION).catch(() => {
      // Registration should still succeed even if the verification email fails to send —
      // the user can request another one via /email/resend.
    });

    const tokens = await sessionService.issue(user, ctx);
    recordAuditLog({
      actorUserId: user.id,
      action: 'auth.register',
      entityType: 'User',
      entityId: user.id,
      ipAddress: ctx.ipAddress,
    });

    return { user, tokens };
  },

  async login(
    input: LoginInput,
    ctx: RequestContext,
  ): Promise<{ user: UserRecord; tokens: AuthTokens }> {
    const user = await authRepository.findUserByEmail(input.email);
    if (!user || !user.passwordHash) {
      throw new InvalidCredentialsError();
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenError(
        `Too many failed attempts. Try again after ${user.lockedUntil.toLocaleTimeString()}.`,
      );
    }

    const isValid = await verifyPassword(input.password, user.passwordHash);
    if (!isValid) {
      await authRepository.recordFailedLogin(
        user.id,
        env.LOGIN_MAX_FAILED_ATTEMPTS,
        env.LOGIN_LOCKOUT_MINUTES,
      );
      recordAuditLog({
        actorUserId: user.id,
        action: 'auth.login_failed',
        entityType: 'User',
        entityId: user.id,
        ipAddress: ctx.ipAddress,
      });
      throw new InvalidCredentialsError();
    }

    if (!user.isActive) {
      throw new UnauthorizedError('This account has been deactivated');
    }

    await authRepository.resetFailedLogin(user.id);
    await authRepository.updateLastLogin(user.id);
    const tokens = await sessionService.issue(user, ctx);

    recordAuditLog({
      actorUserId: user.id,
      action: 'auth.login_success',
      entityType: 'User',
      entityId: user.id,
      ipAddress: ctx.ipAddress,
    });

    // No device-fingerprint/"known devices" tracking exists in this codebase, so this fires on
    // every successful login rather than only unrecognized ones — a documented scope limitation,
    // not an oversight (see Phase 10 completion report).
    await notifyUser({
      userId: user.id,
      type: 'SECURITY_LOGIN',
      title: 'New sign-in to your account',
      message: `We noticed a new sign-in to your account${ctx.ipAddress ? ` from ${ctx.ipAddress}` : ''} at ${new Date().toLocaleString('en-IN')}.`,
      relatedEntityType: 'User',
      relatedEntityId: user.id,
      email: user.email
        ? securityLoginEmail({
            patientName: user.email,
            whenLabel: `at ${new Date().toLocaleString('en-IN')}`,
            actionUrl: `${env.WEB_URL}/settings/security`,
          })
        : undefined,
    });

    return { user, tokens };
  },

  async refresh(refreshToken: string, ctx: RequestContext) {
    const { user: sessionUser, tokens } = await sessionService.rotate(refreshToken, ctx);
    const user = await authRepository.findUserById(sessionUser.id);
    if (!user || !user.isActive) {
      throw new UnauthorizedError();
    }
    return { user, tokens };
  },

  async logout(refreshToken: string): Promise<void> {
    const userId = await sessionService.revokeByToken(refreshToken);
    if (userId) {
      recordAuditLog({
        actorUserId: userId,
        action: 'auth.logout',
        entityType: 'User',
        entityId: userId,
      });
    }
  },

  async logoutAllDevices(userId: string): Promise<{ count: number }> {
    const result = await sessionService.revokeAllForUser(userId, 'logout_all');
    recordAuditLog({
      actorUserId: userId,
      action: 'auth.logout_all',
      entityType: 'User',
      entityId: userId,
      metadata: { sessionsRevoked: result.count },
    });
    return result;
  },

  async me(userId: string) {
    const user = await authRepository.findUserById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError();
    }
    return user;
  },

  async changePassword(
    userId: string,
    currentSessionId: string,
    input: ChangePasswordInput,
  ): Promise<void> {
    const user = await authRepository.findUserById(userId);
    if (!user) {
      throw new UnauthorizedError();
    }
    if (!user.passwordHash) {
      throw new ValidationError(
        "This account doesn't have a password yet. Use 'Forgot password' to set one.",
      );
    }

    const isValid = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new InvalidCredentialsError('Current password is incorrect');
    }

    const newHash = await hashPassword(input.newPassword);
    await authRepository.updatePasswordHash(userId, newHash);
    // Keep the session that made this request alive; force re-login everywhere else.
    await sessionService.revokeAllForUser(userId, 'password_changed', currentSessionId);

    recordAuditLog({
      actorUserId: userId,
      action: 'auth.password_changed',
      entityType: 'User',
      entityId: userId,
    });
    await notifyUser({
      userId,
      type: 'SECURITY_PASSWORD_CHANGED',
      title: 'Password changed',
      message: 'Your account password was changed. If this wasn’t you, contact support immediately.',
      relatedEntityType: 'User',
      relatedEntityId: userId,
    });
  },

  /** Always resolves — never reveals whether the email exists (anti-enumeration). */
  async forgotPassword(email: string): Promise<void> {
    const user = await authRepository.findUserByEmail(email);
    if (!user) return;

    await otpService.request(email, OtpPurpose.PASSWORD_RESET);
    recordAuditLog({
      actorUserId: user.id,
      action: 'auth.password_reset_requested',
      entityType: 'User',
      entityId: user.id,
    });
  },

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    await otpService.verify(input.email, OtpPurpose.PASSWORD_RESET, input.code);

    const user = await authRepository.findUserByEmail(input.email);
    if (!user) {
      throw new NotFoundError('Account');
    }

    const newHash = await hashPassword(input.newPassword);
    await authRepository.updatePasswordHash(user.id, newHash);
    await sessionService.revokeAllForUser(user.id, 'password_reset');

    recordAuditLog({
      actorUserId: user.id,
      action: 'auth.password_reset',
      entityType: 'User',
      entityId: user.id,
    });
  },

  // --- OTP login -----------------------------------------------------------

  async requestOtpLogin(identifier: string): Promise<void> {
    await otpService.request(identifier, OtpPurpose.LOGIN);
  },

  async verifyOtpLogin(identifier: string, code: string, ctx: RequestContext) {
    await otpService.verify(identifier, OtpPurpose.LOGIN, code);

    let user = await authRepository.findUserByIdentifier(identifier);
    let isNewUser = false;

    if (!user) {
      user = await authRepository.createPatientUserFromOtp(identifier);
      isNewUser = true;
    } else {
      if (identifierType(identifier) === 'email' && !user.isEmailVerified) {
        await authRepository.markEmailVerified(user.id);
      }
      if (identifierType(identifier) === 'phone' && !user.isMobileVerified) {
        await authRepository.markMobileVerified(user.id);
      }
      if (!user.isActive) {
        throw new UnauthorizedError('This account has been deactivated');
      }
    }

    await authRepository.updateLastLogin(user.id);
    const tokens = await sessionService.issue(user, ctx);

    recordAuditLog({
      actorUserId: user.id,
      action: isNewUser ? 'auth.otp_login_register' : 'auth.otp_login',
      entityType: 'User',
      entityId: user.id,
      ipAddress: ctx.ipAddress,
    });

    const freshUser = await authRepository.findUserById(user.id);
    return { user: freshUser!, tokens, isNewUser };
  },

  // --- Email verification ---------------------------------------------------

  /** Always resolves — never reveals whether the email exists. */
  async requestEmailVerification(email: string): Promise<void> {
    const user = await authRepository.findUserByEmail(email);
    if (!user || user.isEmailVerified) return;
    await otpService.request(email, OtpPurpose.EMAIL_VERIFICATION);
  },

  async verifyEmail(email: string, code: string): Promise<void> {
    await otpService.verify(email, OtpPurpose.EMAIL_VERIFICATION, code);
    const user = await authRepository.findUserByEmail(email);
    if (!user) {
      throw new NotFoundError('Account');
    }
    await authRepository.markEmailVerified(user.id);
    recordAuditLog({
      actorUserId: user.id,
      action: 'auth.email_verified',
      entityType: 'User',
      entityId: user.id,
    });
  },
};
