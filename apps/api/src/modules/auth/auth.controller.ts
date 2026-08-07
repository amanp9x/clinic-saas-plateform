import type { Request, Response } from 'express';
import { authService } from './auth.service.js';
import {
  REFRESH_COOKIE,
  clearRefreshCookie,
  sendAuthPayload,
  toPublicUser,
} from './auth.response.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { UnauthorizedError } from '../../utils/app-error.js';

function requestContext(req: Request) {
  return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
}

function readRefreshToken(req: Request): string | undefined {
  return req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
}

export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const { user, tokens } = await authService.register(req.body, requestContext(req));
    sendAuthPayload(res, { user, tokens }, { status: 201, message: 'Account created' });
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const { user, tokens } = await authService.login(req.body, requestContext(req));
    sendAuthPayload(res, { user, tokens });
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const token = readRefreshToken(req);
    if (!token) {
      throw new UnauthorizedError('Missing refresh token');
    }
    const { user, tokens } = await authService.refresh(token, requestContext(req));
    sendAuthPayload(res, { user, tokens });
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.me(req.user!.id);
    sendSuccess(res, { user: toPublicUser(user) });
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    const token = readRefreshToken(req);
    if (token) {
      await authService.logout(token);
    }
    clearRefreshCookie(res);
    sendSuccess(res, null, { message: 'Logged out' });
  }),

  logoutAll: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.logoutAllDevices(req.user!.id);
    clearRefreshCookie(res);
    sendSuccess(res, { sessionsRevoked: result.count }, { message: 'Logged out of all devices' });
  }),

  changePassword: asyncHandler(async (req: Request, res: Response) => {
    await authService.changePassword(req.user!.id, req.user!.sessionId, req.body);
    sendSuccess(res, null, { message: 'Password changed' });
  }),

  forgotPassword: asyncHandler(async (req: Request, res: Response) => {
    await authService.forgotPassword(req.body.email);
    sendSuccess(res, null, {
      message: 'If an account with that email exists, a reset code has been sent.',
    });
  }),

  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    await authService.resetPassword(req.body);
    sendSuccess(res, null, { message: 'Password reset. Please log in with your new password.' });
  }),
};
