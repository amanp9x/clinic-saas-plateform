import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { UserRole } from '@clinic/shared';
import { authorize } from '../../src/middleware/authorize.js';
import { ForbiddenError, UnauthorizedError } from '../../src/utils/app-error.js';

function mockReq(user?: { id: string; role: string; sessionId: string }): Request {
  return { user } as unknown as Request;
}

describe('authorize middleware', () => {
  it('calls next() when the user has an allowed role', () => {
    const next = vi.fn();
    const req = mockReq({ id: 'u1', role: UserRole.CLINIC_ADMIN, sessionId: 's1' });

    authorize(UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN)(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("throws ForbiddenError when the user's role is not allowed", () => {
    const req = mockReq({ id: 'u1', role: UserRole.PATIENT, sessionId: 's1' });

    expect(() => authorize(UserRole.CLINIC_ADMIN)(req, {} as Response, vi.fn())).toThrow(
      ForbiddenError,
    );
  });

  it('throws UnauthorizedError when there is no authenticated user', () => {
    const req = mockReq(undefined);

    expect(() => authorize(UserRole.PATIENT)(req, {} as Response, vi.fn())).toThrow(
      UnauthorizedError,
    );
  });
});
