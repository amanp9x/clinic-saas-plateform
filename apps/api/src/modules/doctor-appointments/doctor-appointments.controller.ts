import type { Request, Response } from 'express';
import { doctorAppointmentsService } from './doctor-appointments.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const doctorAppointmentsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await doctorAppointmentsService.list(req.user!.id, req.query as never);
    sendSuccess(res, result);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const appointment = await doctorAppointmentsService.getById(req.user!.id, req.params.id!);
    sendSuccess(res, { appointment });
  }),

  start: asyncHandler(async (req: Request, res: Response) => {
    const appointment = await doctorAppointmentsService.start(req.user!.id, req.params.id!);
    sendSuccess(res, { appointment }, { message: 'Consultation started' });
  }),

  markNoShow: asyncHandler(async (req: Request, res: Response) => {
    const appointment = await doctorAppointmentsService.markNoShow(req.user!.id, req.params.id!);
    sendSuccess(res, { appointment }, { message: 'Marked as no-show' });
  }),

  skip: asyncHandler(async (req: Request, res: Response) => {
    const appointment = await doctorAppointmentsService.skip(req.user!.id, req.params.id!, req.body?.reason);
    sendSuccess(res, { appointment }, { message: 'Patient skipped' });
  }),
};
