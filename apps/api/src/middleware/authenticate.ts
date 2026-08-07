import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { UnauthorizedError } from '../utils/app-error.js';
import { asyncHandler } from '../utils/async-handler.js';

/** Verifies the bearer access token and attaches the authenticated principal to req.user. */
export const authenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing bearer token');
    }

    const token = header.slice('Bearer '.length);
    const payload = verifyAccessToken(token);

    req.user = { id: payload.sub, role: payload.role, sessionId: payload.sessionId };
    next();
  },
);

/** Attaches req.user when a valid token is present, but does not require one. */
export const optionalAuthenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      const payload = verifyAccessToken(header.slice('Bearer '.length));
      req.user = { id: payload.sub, role: payload.role, sessionId: payload.sessionId };
    }
    next();
  },
);
