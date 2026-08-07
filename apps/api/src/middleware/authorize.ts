import type { NextFunction, Request, Response } from 'express';
import type { UserRole } from '@clinic/shared';
import { ForbiddenError, UnauthorizedError } from '../utils/app-error.js';

/** RBAC guard. Must run after `authenticate`. Usage: authorize(UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN) */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError();
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError();
    }
    next();
  };
}
