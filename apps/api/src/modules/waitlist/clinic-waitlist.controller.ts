import type { Request, Response } from 'express';
import { clinicWaitlistService } from './clinic-waitlist.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const clinicWaitlistController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await clinicWaitlistService.list(req.user!.id, req.user!.role, req.query as never);
    sendSuccess(res, result);
  }),

  add: asyncHandler(async (req: Request, res: Response) => {
    const entry = await clinicWaitlistService.add(req.user!.id, req.user!.role, req.body);
    sendSuccess(res, { entry }, { status: 201, message: 'Added to waitlist' });
  }),

  cancel: asyncHandler(async (req: Request, res: Response) => {
    const clinicId = (req.query as { clinicId: string }).clinicId;
    await clinicWaitlistService.cancel(req.user!.id, req.user!.role, clinicId, req.params.id!);
    sendSuccess(res, null, { message: 'Removed from waitlist' });
  }),
};
