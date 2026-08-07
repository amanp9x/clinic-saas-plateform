import type { Request, Response } from 'express';
import { sessionService } from './session.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const sessionController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const sessions = await sessionService.listForUser(req.user!.id, req.user!.sessionId);
    sendSuccess(res, { sessions });
  }),

  revoke: asyncHandler(async (req: Request, res: Response) => {
    await sessionService.revokeOne(req.params.id!, req.user!.id);
    sendSuccess(res, null, { message: 'Session signed out' });
  }),
};
