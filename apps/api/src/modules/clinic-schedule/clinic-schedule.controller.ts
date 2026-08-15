import type { Request, Response } from 'express';
import { clinicScheduleService } from './clinic-schedule.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const clinicScheduleController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const workingHours = await clinicScheduleService.list(req.user!.id, req.user!.role, req.query.clinicId as string);
    sendSuccess(res, { workingHours });
  }),

  upsert: asyncHandler(async (req: Request, res: Response) => {
    const { clinicId, ...input } = req.body;
    const workingHours = await clinicScheduleService.upsert(req.user!.id, req.user!.role, clinicId, input);
    sendSuccess(res, { workingHours }, { message: 'Working hours updated' });
  }),
};
