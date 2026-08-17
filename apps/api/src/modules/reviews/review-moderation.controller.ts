import type { Request, Response } from 'express';
import { reviewModerationService } from './review-moderation.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const reviewModerationController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await reviewModerationService.list(req.user!.id, req.user!.role, req.query as never);
    sendSuccess(res, result);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const review = await reviewModerationService.getById(req.user!.id, req.user!.role, req.params.id!);
    sendSuccess(res, { review });
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const review = await reviewModerationService.updateStatus(req.user!.id, req.user!.role, req.params.id!, req.body);
    sendSuccess(res, { review }, { message: 'Review updated' });
  }),

  respond: asyncHandler(async (req: Request, res: Response) => {
    const review = await reviewModerationService.respond(req.user!.id, req.user!.role, req.params.id!, req.body);
    sendSuccess(res, { review }, { message: 'Response posted' });
  }),
};
