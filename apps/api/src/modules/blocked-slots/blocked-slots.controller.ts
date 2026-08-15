import type { Request, Response } from 'express';
import { blockedSlotsService } from './blocked-slots.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const blockedSlotsController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const block = await blockedSlotsService.create(req.user!.id, req.user!.role, req.body);
    sendSuccess(res, { block }, { status: 201, message: 'Slot blocked' });
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const blocks = await blockedSlotsService.list(req.user!.id, req.user!.role, req.query.clinicId as string, req.query.doctorId as string | undefined);
    sendSuccess(res, { blocks });
  }),

  unblock: asyncHandler(async (req: Request, res: Response) => {
    await blockedSlotsService.unblock(req.user!.id, req.user!.role, req.query.clinicId as string, req.params.id!);
    sendSuccess(res, null, { message: 'Slot unblocked' });
  }),
};
