import type { Request, Response } from 'express';
import { clinicFollowUpsService } from './clinic-follow-ups.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const clinicFollowUpsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await clinicFollowUpsService.list(req.user!.id, req.user!.role, req.query as never);
    sendSuccess(res, result);
  }),
};
