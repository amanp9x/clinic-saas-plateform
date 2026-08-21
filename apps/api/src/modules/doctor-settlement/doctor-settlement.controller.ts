import type { Request, Response } from 'express';
import { doctorSettlementService } from './doctor-settlement.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const doctorSettlementController = {
  request: asyncHandler(async (req: Request, res: Response) => {
    const settlement = await doctorSettlementService.request(req.user!.id, req.body);
    sendSuccess(res, { settlement }, { status: 201, message: 'Settlement requested' });
  }),

  listForDoctor: asyncHandler(async (req: Request, res: Response) => {
    const result = await doctorSettlementService.listForDoctor(req.user!.id, req.query as never);
    sendSuccess(res, result);
  }),

  listForPlatform: asyncHandler(async (req: Request, res: Response) => {
    const result = await doctorSettlementService.listForPlatform(req.query as never);
    sendSuccess(res, result);
  }),

  getDetailForPlatform: asyncHandler(async (req: Request, res: Response) => {
    const settlement = await doctorSettlementService.getDetailForPlatform(req.params.id!);
    sendSuccess(res, { settlement });
  }),

  approve: asyncHandler(async (req: Request, res: Response) => {
    const settlement = await doctorSettlementService.approve(req.user!.id, req.params.id!, req.body);
    sendSuccess(res, { settlement }, { message: 'Settlement approved' });
  }),

  reject: asyncHandler(async (req: Request, res: Response) => {
    const settlement = await doctorSettlementService.reject(req.user!.id, req.params.id!, req.body);
    sendSuccess(res, { settlement }, { message: 'Settlement rejected' });
  }),

  markPaid: asyncHandler(async (req: Request, res: Response) => {
    const settlement = await doctorSettlementService.markPaid(req.user!.id, req.params.id!, req.body);
    sendSuccess(res, { settlement }, { message: 'Settlement marked as paid' });
  }),
};
