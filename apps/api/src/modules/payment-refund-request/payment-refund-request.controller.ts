import type { Request, Response } from 'express';
import { refundRequestService } from './payment-refund-request.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const refundRequestController = {
  request: asyncHandler(async (req: Request, res: Response) => {
    const refundRequest = await refundRequestService.request(req.user!.id, req.params.id!, req.body);
    sendSuccess(res, { refundRequest }, { status: 201, message: 'Refund requested' });
  }),

  listForClinic: asyncHandler(async (req: Request, res: Response) => {
    const result = await refundRequestService.listForClinic(req.user!.id, req.user!.role, req.query as never);
    sendSuccess(res, result);
  }),

  approve: asyncHandler(async (req: Request, res: Response) => {
    const refundRequest = await refundRequestService.approve(req.user!.id, req.user!.role, req.params.id!, req.body);
    sendSuccess(res, { refundRequest }, { message: 'Refund request approved' });
  }),

  reject: asyncHandler(async (req: Request, res: Response) => {
    const refundRequest = await refundRequestService.reject(req.user!.id, req.user!.role, req.params.id!, req.body);
    sendSuccess(res, { refundRequest }, { message: 'Refund request rejected' });
  }),
};
