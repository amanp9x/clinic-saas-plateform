import type { Request, Response } from 'express';
import { clinicHolidaysService } from './clinic-holidays.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const clinicHolidaysController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const holidays = await clinicHolidaysService.list(req.user!.id, req.user!.role, req.query.clinicId as string);
    sendSuccess(res, { holidays });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const { clinicId, ...input } = req.body;
    const holiday = await clinicHolidaysService.create(req.user!.id, req.user!.role, clinicId, input);
    sendSuccess(res, { holiday }, { status: 201, message: 'Holiday added' });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await clinicHolidaysService.remove(req.user!.id, req.user!.role, req.query.clinicId as string, req.params.id as string);
    sendSuccess(res, null, { message: 'Holiday removed' });
  }),
};
