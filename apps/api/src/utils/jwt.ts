import { randomUUID } from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { JwtPayload, UserRole } from '@clinic/shared';
import { env } from '../config/env.js';
import { TokenExpiredError, TokenInvalidError } from './app-error.js';

export function signAccessToken(payload: {
  sub: string;
  role: UserRole;
  sessionId: string;
}): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    // Every signed token must be unique even when re-issued for the same session within the
    // same second (HMAC signing is otherwise deterministic) — refresh-token reuse detection
    // depends on each rotation producing a distinguishable token.
    jwtid: randomUUID(),
  } as SignOptions);
}

export function signRefreshToken(payload: {
  sub: string;
  role: UserRole;
  sessionId: string;
}): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    jwtid: randomUUID(),
  } as SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  return verify(token, env.JWT_ACCESS_SECRET);
}

export function verifyRefreshToken(token: string): JwtPayload {
  return verify(token, env.JWT_REFRESH_SECRET);
}

function verify(token: string, secret: string): JwtPayload {
  try {
    return jwt.verify(token, secret) as JwtPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new TokenExpiredError();
    }
    throw new TokenInvalidError();
  }
}
