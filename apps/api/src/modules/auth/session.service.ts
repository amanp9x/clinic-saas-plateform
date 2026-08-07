import { randomUUID } from 'node:crypto';
import ms from 'ms';
import type { UserRole } from '@prisma/client';
import type { AuthTokens, SessionSummary } from '@clinic/shared';
import { sessionRepository } from './session.repository.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import { sha256Hex } from '../../utils/hash.js';
import { parseDeviceLabel } from '../../utils/device.js';
import { env } from '../../config/env.js';
import { UnauthorizedError } from '../../utils/app-error.js';
import { logger } from '../../config/logger.js';

export interface RequestContext {
  userAgent?: string;
  ipAddress?: string;
}

interface SessionUser {
  id: string;
  role: UserRole;
}

function refreshExpiryDate(): Date {
  return new Date(Date.now() + ms(env.JWT_REFRESH_EXPIRES_IN));
}

export const sessionService = {
  /** Creates a brand-new session (login/register/OTP-login) and returns its token pair. */
  async issue(user: SessionUser, ctx: RequestContext): Promise<AuthTokens> {
    const sessionId = randomUUID();
    const accessToken = signAccessToken({ sub: user.id, role: user.role, sessionId });
    const refreshToken = signRefreshToken({ sub: user.id, role: user.role, sessionId });
    const expiresAt = refreshExpiryDate();

    await sessionRepository.create({
      id: sessionId,
      userId: user.id,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
      deviceLabel: parseDeviceLabel(ctx.userAgent),
      sessionExpiresAt: expiresAt,
      tokenHash: sha256Hex(refreshToken),
      tokenExpiresAt: expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: Math.floor(ms(env.JWT_ACCESS_EXPIRES_IN) / 1000),
    };
  },

  /**
   * Rotates the refresh token for the session encoded in `presentedToken`. If the presented
   * token doesn't match the session's currently-valid hash, it's a reuse of an already-rotated
   * (and therefore possibly stolen) token — the whole session is revoked as a security response.
   */
  async rotate(
    presentedToken: string,
    ctx: RequestContext,
  ): Promise<{ user: SessionUser; tokens: AuthTokens }> {
    const payload = verifyRefreshToken(presentedToken);
    const session = await sessionRepository.findActiveWithToken(payload.sessionId);

    if (!session || !session.refreshToken) {
      throw new UnauthorizedError('Session has expired or been revoked. Please log in again.');
    }

    if (session.refreshToken.tokenHash !== sha256Hex(presentedToken)) {
      await sessionRepository.revoke(session.id, 'refresh_token_reuse_detected');
      logger.warn(
        { sessionId: session.id, userId: session.userId },
        'Refresh token reuse detected — session revoked',
      );
      throw new UnauthorizedError(
        'Session has been revoked due to suspicious activity. Please log in again.',
      );
    }

    const newRefreshToken = signRefreshToken({
      sub: payload.sub,
      role: payload.role,
      sessionId: session.id,
    });
    const newAccessToken = signAccessToken({
      sub: payload.sub,
      role: payload.role,
      sessionId: session.id,
    });
    const expiresAt = refreshExpiryDate();

    await sessionRepository.rotateToken(session.id, {
      tokenHash: sha256Hex(newRefreshToken),
      tokenExpiresAt: expiresAt,
      sessionExpiresAt: expiresAt,
      userAgent: ctx.userAgent,
      ipAddress: ctx.ipAddress,
    });

    return {
      user: { id: payload.sub, role: payload.role },
      tokens: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: Math.floor(ms(env.JWT_ACCESS_EXPIRES_IN) / 1000),
      },
    };
  },

  /** Logout from the current device only. Returns the affected user id, or null if the token was already invalid. */
  async revokeByToken(presentedToken: string): Promise<string | null> {
    try {
      const payload = verifyRefreshToken(presentedToken);
      await sessionRepository.revoke(payload.sessionId, 'logout');
      return payload.sub;
    } catch {
      // Already invalid/expired token — logout is idempotent either way.
      return null;
    }
  },

  /** Logout from all devices. Pass `exceptSessionId` to keep the current session alive (e.g. after a password change). */
  revokeAllForUser(
    userId: string,
    reason: string,
    exceptSessionId?: string,
  ): Promise<{ count: number }> {
    return sessionRepository.revokeAllForUser(userId, reason, exceptSessionId);
  },

  /** Revoke a specific session by id — must belong to the requesting user. */
  async revokeOne(sessionId: string, userId: string): Promise<void> {
    const result = await sessionRepository.revokeOwnedByUser(sessionId, userId, 'revoked_by_user');
    if (result.count === 0) {
      throw new UnauthorizedError('Session not found');
    }
  },

  async listForUser(userId: string, currentSessionId: string): Promise<SessionSummary[]> {
    const sessions = await sessionRepository.listActiveForUser(userId);
    return sessions.map((session) => ({
      id: session.id,
      deviceLabel: session.deviceLabel,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      createdAt: session.createdAt.toISOString(),
      lastUsedAt: session.lastUsedAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      isCurrent: session.id === currentSessionId,
    }));
  },
};
