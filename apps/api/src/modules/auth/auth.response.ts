import type { Response } from 'express';
import type { AuthenticatedUser, AuthTokens } from '@clinic/shared';
import { isProduction } from '../../config/env.js';

const REFRESH_COOKIE = 'refreshToken';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

interface PublicUserSource {
  id: string;
  email: string | null;
  phone: string | null;
  role: import('@clinic/shared').UserRole;
  isEmailVerified: boolean;
  isMobileVerified: boolean;
}

export function toPublicUser(user: PublicUserSource): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    isMobileVerified: user.isMobileVerified,
  };
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
}

export function sendAuthPayload(
  res: Response,
  data: { user: PublicUserSource; tokens: AuthTokens; isNewUser?: boolean },
  opts: { status?: number; message?: string } = {},
): Response {
  setRefreshCookie(res, data.tokens.refreshToken);
  return res.status(opts.status ?? 200).json({
    success: true,
    data: {
      user: toPublicUser(data.user),
      accessToken: data.tokens.accessToken,
      expiresIn: data.tokens.expiresIn,
      ...(data.isNewUser !== undefined ? { isNewUser: data.isNewUser } : {}),
    },
    message: opts.message,
  });
}

export { REFRESH_COOKIE };
