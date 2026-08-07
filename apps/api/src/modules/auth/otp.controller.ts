import type { Request, Response } from 'express';
import { authService } from './auth.service.js';
import { sendAuthPayload } from './auth.response.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

function requestContext(req: Request) {
  return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
}

export const otpController = {
  requestLogin: asyncHandler(async (req: Request, res: Response) => {
    await authService.requestOtpLogin(req.body.identifier);
    sendSuccess(res, null, { message: 'If that account exists, a code has been sent.' });
  }),

  verifyLogin: asyncHandler(async (req: Request, res: Response) => {
    const { user, tokens, isNewUser } = await authService.verifyOtpLogin(
      req.body.identifier,
      req.body.code,
      requestContext(req),
    );
    sendAuthPayload(res, { user, tokens, isNewUser });
  }),

  resendEmailVerification: asyncHandler(async (req: Request, res: Response) => {
    await authService.requestEmailVerification(req.body.email);
    sendSuccess(res, null, {
      message: 'If that account needs verification, a code has been sent.',
    });
  }),

  verifyEmail: asyncHandler(async (req: Request, res: Response) => {
    await authService.verifyEmail(req.body.email, req.body.code);
    sendSuccess(res, null, { message: 'Email verified' });
  }),
};
