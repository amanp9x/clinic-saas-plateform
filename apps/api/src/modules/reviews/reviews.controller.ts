import type { Request, Response } from 'express';
import { reviewsService } from './reviews.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const reviewsController = {
  checkEligibility: asyncHandler(async (req: Request, res: Response) => {
    const appointmentId = (req.query as { appointmentId: string }).appointmentId;
    const eligibility = await reviewsService.checkEligibility(req.user!.id, appointmentId);
    sendSuccess(res, { eligibility });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const reviews = await reviewsService.create(req.user!.id, req.body);
    sendSuccess(res, { reviews }, { status: 201, message: 'Thank you for your feedback' });
  }),

  listMy: asyncHandler(async (req: Request, res: Response) => {
    const result = await reviewsService.listMy(req.user!.id, req.query as never);
    sendSuccess(res, result);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const review = await reviewsService.update(req.user!.id, req.params.id!, req.body);
    sendSuccess(res, { review }, { message: 'Review updated' });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await reviewsService.delete(req.user!.id, req.params.id!);
    sendSuccess(res, null, { message: 'Review deleted' });
  }),
};
