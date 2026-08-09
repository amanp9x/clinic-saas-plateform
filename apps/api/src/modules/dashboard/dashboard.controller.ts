import type { Request, Response } from 'express';
import { dashboardService } from './dashboard.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const dashboardController = {
  getSummary: asyncHandler(async (req: Request, res: Response) => {
    const summary = await dashboardService.getSummary(req.user!.id);
    sendSuccess(res, { summary });
  }),
};
