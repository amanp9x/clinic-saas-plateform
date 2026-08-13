import type { Request, Response } from 'express';
import { receptionCheckinService } from './reception-checkin.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const receptionCheckinController = {
  checkIn: asyncHandler(async (req: Request, res: Response) => {
    const token = await receptionCheckinService.checkIn(req.user!.id, req.user!.role, req.body);
    sendSuccess(res, { token }, { message: 'Patient checked in' });
  }),

  walkIn: asyncHandler(async (req: Request, res: Response) => {
    const result = await receptionCheckinService.registerWalkIn(req.user!.id, req.user!.role, req.body);
    sendSuccess(res, result, { message: 'Walk-in registered' });
  }),
};
