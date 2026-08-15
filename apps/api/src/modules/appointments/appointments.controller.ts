import type { Request, Response } from 'express';
import { appointmentsService } from './appointments.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const appointmentsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await appointmentsService.list(req.user!.id, req.query as never);
    sendSuccess(res, result);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const appointment = await appointmentsService.getById(req.user!.id, req.params.id!);
    sendSuccess(res, { appointment });
  }),

  cancel: asyncHandler(async (req: Request, res: Response) => {
    const appointment = await appointmentsService.cancel(req.user!.id, req.params.id!, req.body);
    sendSuccess(res, { appointment }, { message: 'Appointment cancelled' });
  }),

  getQueueView: asyncHandler(async (req: Request, res: Response) => {
    const queue = await appointmentsService.getQueueView(req.user!.id, req.params.id!);
    sendSuccess(res, { queue });
  }),

  getAvailability: asyncHandler(async (req: Request, res: Response) => {
    const result = await appointmentsService.getAvailability(req.query as never);
    sendSuccess(res, result);
  }),

  holdSlot: asyncHandler(async (req: Request, res: Response) => {
    const hold = await appointmentsService.holdSlot(req.user!.id, req.body);
    sendSuccess(res, { hold }, { status: 201 });
  }),

  releaseHold: asyncHandler(async (req: Request, res: Response) => {
    await appointmentsService.releaseHold(req.user!.id, req.params.id!);
    sendSuccess(res, null);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const appointment = await appointmentsService.create(req.user!.id, req.body);
    sendSuccess(res, { appointment }, { status: 201, message: 'Appointment booked' });
  }),

  reschedule: asyncHandler(async (req: Request, res: Response) => {
    const appointment = await appointmentsService.reschedule(req.user!.id, req.params.id!, req.body);
    sendSuccess(res, { appointment }, { message: 'Appointment rescheduled' });
  }),
};
