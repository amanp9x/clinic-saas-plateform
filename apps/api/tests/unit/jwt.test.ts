import { describe, expect, it } from 'vitest';
import { UserRole } from '@clinic/shared';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../../src/utils/jwt.js';
import { TokenInvalidError } from '../../src/utils/app-error.js';

const payload = { sub: 'user-1', role: UserRole.PATIENT, sessionId: 'session-1' };

describe('jwt utils', () => {
  it('round-trips an access token', () => {
    const token = signAccessToken(payload);
    const decoded = verifyAccessToken(token);
    expect(decoded).toMatchObject(payload);
  });

  it('round-trips a refresh token', () => {
    const token = signRefreshToken(payload);
    const decoded = verifyRefreshToken(token);
    expect(decoded).toMatchObject(payload);
  });

  it('produces distinct tokens for repeated calls with identical payloads', () => {
    // Reuse-detection on refresh depends on this: a rotated token must never collide
    // with the token it replaced, even when both are signed within the same second.
    const tokenA = signRefreshToken(payload);
    const tokenB = signRefreshToken(payload);
    expect(tokenA).not.toBe(tokenB);
  });

  it('rejects a token signed with a different secret', () => {
    const accessToken = signAccessToken(payload);
    expect(() => verifyRefreshToken(accessToken)).toThrow(TokenInvalidError);
  });

  it('rejects a malformed token', () => {
    expect(() => verifyAccessToken('not-a-jwt')).toThrow(TokenInvalidError);
  });
});
