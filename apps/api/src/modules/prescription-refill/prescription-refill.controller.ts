import type { Request, Response } from 'express';
import { prescriptionRefillService } from './prescription-refill.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const prescriptionRefillController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const request = await prescriptionRefillService.create(req.user!.id, req.params.id!, req.body);
    sendSuccess(res, { request }, { status: 201, message: 'Refill request submitted' });
  }),

  listForPatient: asyncHandler(async (req: Request, res: Response) => {
    const result = await prescriptionRefillService.listForPatient(req.user!.id, req.query as never);
    sendSuccess(res, result);
  }),

  listForDoctor: asyncHandler(async (req: Request, res: Response) => {
    const result = await prescriptionRefillService.listForDoctor(req.user!.id, req.query as never);
    sendSuccess(res, result);
  }),

  respond: asyncHandler(async (req: Request, res: Response) => {
    const request = await prescriptionRefillService.respond(req.user!.id, req.params.id!, req.body);
    sendSuccess(res, { request }, { message: 'Refill request updated' });
  }),
};
