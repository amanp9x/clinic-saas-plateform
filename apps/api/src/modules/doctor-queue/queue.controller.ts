import type { Request, Response } from 'express';
import { queueService } from './queue.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const queueController = {
  getSnapshot: asyncHandler(async (req: Request, res: Response) => {
    const queue = await queueService.getSnapshot(req.user!.id, req.query.clinicId as string);
    sendSuccess(res, { queue });
  }),

  startSession: asyncHandler(async (req: Request, res: Response) => {
    const queue = await queueService.startSession(req.user!.id, req.body.clinicId);
    sendSuccess(res, { queue }, { message: 'Queue session started' });
  }),

  pauseSession: asyncHandler(async (req: Request, res: Response) => {
    const queue = await queueService.pauseSession(req.user!.id, req.body.clinicId);
    sendSuccess(res, { queue }, { message: 'Queue paused' });
  }),

  resumeSession: asyncHandler(async (req: Request, res: Response) => {
    const queue = await queueService.resumeSession(req.user!.id, req.body.clinicId);
    sendSuccess(res, { queue }, { message: 'Queue resumed' });
  }),

  callNext: asyncHandler(async (req: Request, res: Response) => {
    const queue = await queueService.callNext(req.user!.id, req.body.clinicId);
    sendSuccess(res, { queue }, { message: 'Next patient called' });
  }),

  repeatCall: asyncHandler(async (req: Request, res: Response) => {
    const queue = await queueService.repeatCall(req.user!.id, req.body.clinicId, req.body.tokenId);
    sendSuccess(res, { queue }, { message: 'Patient re-called' });
  }),

  skip: asyncHandler(async (req: Request, res: Response) => {
    const queue = await queueService.skip(req.user!.id, req.body.clinicId, req.body.tokenId, req.body.reason);
    sendSuccess(res, { queue }, { message: 'Patient skipped' });
  }),

  updateDelay: asyncHandler(async (req: Request, res: Response) => {
    const queue = await queueService.updateDelay(req.user!.id, req.body.clinicId, req.body.delayMinutes, req.body.delayReason);
    sendSuccess(res, { queue }, { message: 'Delay updated' });
  }),
};
