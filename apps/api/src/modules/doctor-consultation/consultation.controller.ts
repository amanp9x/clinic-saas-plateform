import type { Request, Response } from 'express';
import { consultationService } from './consultation.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const consultationController = {
  get: asyncHandler(async (req: Request, res: Response) => {
    const consultation = await consultationService.get(req.user!.id, req.params.appointmentId!);
    sendSuccess(res, { consultation });
  }),

  upsert: asyncHandler(async (req: Request, res: Response) => {
    const consultation = await consultationService.upsert(req.user!.id, req.params.appointmentId!, req.body);
    sendSuccess(res, { consultation }, { message: 'Consultation saved' });
  }),

  complete: asyncHandler(async (req: Request, res: Response) => {
    const consultation = await consultationService.complete(req.user!.id, req.params.appointmentId!);
    sendSuccess(res, { consultation }, { message: 'Consultation completed' });
  }),
};
