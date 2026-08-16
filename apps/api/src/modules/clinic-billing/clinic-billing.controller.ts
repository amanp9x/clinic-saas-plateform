import type { Request, Response } from 'express';
import { paymentEngine } from '../payments/payment.engine.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const clinicBillingController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await paymentEngine.getClinicBilling(req.user!.id, req.user!.role, req.query as never);
    sendSuccess(res, result);
  }),
};
