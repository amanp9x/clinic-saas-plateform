import type { Request, Response } from 'express';
import { paymentEngine } from './payment.engine.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const paymentController = {
  createOrder: asyncHandler(async (req: Request, res: Response) => {
    const order = await paymentEngine.createOrder(req.user!.id, req.body.appointmentId);
    sendSuccess(res, { order }, { status: 201, message: 'Payment order created' });
  }),

  retryOrder: asyncHandler(async (req: Request, res: Response) => {
    const order = await paymentEngine.retryOrder(req.user!.id, req.params.id!);
    sendSuccess(res, { order }, { message: 'Payment retry order created' });
  }),

  simulateCheckout: asyncHandler(async (req: Request, res: Response) => {
    const outcome = req.body.outcome === 'failure' ? 'failure' : 'success';
    const result = await paymentEngine.simulateCheckout(req.user!.id, req.params.id!, outcome);
    sendSuccess(res, result);
  }),

  verify: asyncHandler(async (req: Request, res: Response) => {
    const payment = await paymentEngine.verifyPayment(req.user!.id, req.body);
    sendSuccess(res, { payment }, { message: 'Payment verified' });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const payment = await paymentEngine.getById(req.user!.id, req.user!.role, req.params.id!);
    sendSuccess(res, { payment });
  }),

  getStatus: asyncHandler(async (req: Request, res: Response) => {
    const status = await paymentEngine.getStatus(req.user!.id, req.user!.role, req.params.id!);
    sendSuccess(res, status);
  }),

  getReceipt: asyncHandler(async (req: Request, res: Response) => {
    const { buffer, filename } = await paymentEngine.getReceiptPdf(req.user!.id, req.user!.role, req.params.id!);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(buffer);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await paymentEngine.listMyPayments(req.user!.id, req.query as never);
    sendSuccess(res, result);
  }),

  refund: asyncHandler(async (req: Request, res: Response) => {
    const payment = await paymentEngine.refund(req.user!.id, req.user!.role, req.params.id!, req.body);
    sendSuccess(res, { payment }, { message: 'Refund processed' });
  }),
};
