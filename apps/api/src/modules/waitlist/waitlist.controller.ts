import type { Request, Response } from 'express';
import { waitlistService } from './waitlist.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const waitlistController = {
  join: asyncHandler(async (req: Request, res: Response) => {
    const entry = await waitlistService.join(req.user!.id, req.body);
    sendSuccess(res, { entry }, { status: 201, message: "You're on the waitlist" });
  }),

  listMy: asyncHandler(async (req: Request, res: Response) => {
    const result = await waitlistService.listMy(req.user!.id, req.query as never);
    sendSuccess(res, result);
  }),

  cancel: asyncHandler(async (req: Request, res: Response) => {
    await waitlistService.cancel(req.user!.id, req.params.id!);
    sendSuccess(res, null, { message: 'Removed from waitlist' });
  }),
};
