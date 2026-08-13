import type { Request, Response } from 'express';
import { receptionQueueService } from './reception-queue.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const receptionQueueController = {
  getSnapshot: asyncHandler(async (req: Request, res: Response) => {
    const queue = await receptionQueueService.getSnapshot(req.user!.id, req.user!.role, req.query.clinicId as string, req.query.doctorId as string);
    sendSuccess(res, { queue });
  }),

  callNext: asyncHandler(async (req: Request, res: Response) => {
    const queue = await receptionQueueService.callNext(req.user!.id, req.user!.role, req.body.clinicId, req.body.doctorId);
    sendSuccess(res, { queue }, { message: 'Next patient called' });
  }),

  repeatCall: asyncHandler(async (req: Request, res: Response) => {
    const queue = await receptionQueueService.repeatCall(req.user!.id, req.user!.role, req.body.clinicId, req.body.doctorId, req.body.tokenId);
    sendSuccess(res, { queue }, { message: 'Patient re-called' });
  }),

  skip: asyncHandler(async (req: Request, res: Response) => {
    const queue = await receptionQueueService.skip(req.user!.id, req.user!.role, req.body.clinicId, req.body.doctorId, req.body.tokenId, req.body.reason);
    sendSuccess(res, { queue }, { message: 'Patient skipped' });
  }),

  pauseSession: asyncHandler(async (req: Request, res: Response) => {
    const queue = await receptionQueueService.pauseSession(req.user!.id, req.user!.role, req.body.clinicId, req.body.doctorId, req.body.reason);
    sendSuccess(res, { queue }, { message: 'Queue paused' });
  }),

  resumeSession: asyncHandler(async (req: Request, res: Response) => {
    const queue = await receptionQueueService.resumeSession(req.user!.id, req.user!.role, req.body.clinicId, req.body.doctorId);
    sendSuccess(res, { queue }, { message: 'Queue resumed' });
  }),

  updateDelay: asyncHandler(async (req: Request, res: Response) => {
    const queue = await receptionQueueService.updateDelay(req.user!.id, req.user!.role, req.body.clinicId, req.body.doctorId, req.body.delayMinutes, req.body.delayReason);
    sendSuccess(res, { queue }, { message: 'Delay updated' });
  }),

  updatePriority: asyncHandler(async (req: Request, res: Response) => {
    const queue = await receptionQueueService.updatePriority(req.user!.id, req.user!.role, req.body.clinicId, req.body.doctorId, req.body.tokenId, req.body.priority);
    sendSuccess(res, { queue }, { message: 'Priority updated' });
  }),

  markInConsultation: asyncHandler(async (req: Request, res: Response) => {
    const queue = await receptionQueueService.markInConsultation(req.user!.id, req.user!.role, req.body.clinicId, req.body.doctorId, req.body.appointmentId);
    sendSuccess(res, { queue }, { message: 'Consultation started' });
  }),

  markCompleted: asyncHandler(async (req: Request, res: Response) => {
    const queue = await receptionQueueService.markCompleted(req.user!.id, req.user!.role, req.body.clinicId, req.body.doctorId, req.body.appointmentId);
    sendSuccess(res, { queue }, { message: 'Consultation completed' });
  }),

  markNoShow: asyncHandler(async (req: Request, res: Response) => {
    const queue = await receptionQueueService.markNoShow(req.user!.id, req.user!.role, req.body.clinicId, req.body.doctorId, req.body.appointmentId);
    sendSuccess(res, { queue }, { message: 'Marked as no-show' });
  }),

  history: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as { clinicId: string; date?: string; page: number; limit: number };
    const history = await receptionQueueService.history(req.user!.id, req.user!.role, query.clinicId, query.date, query.page, query.limit);
    sendSuccess(res, { history });
  }),
};
