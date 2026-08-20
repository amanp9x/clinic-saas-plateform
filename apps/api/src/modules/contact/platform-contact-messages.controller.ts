import type { Request, Response } from 'express';
import { platformContactMessagesService } from './platform-contact-messages.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const platformContactMessagesController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await platformContactMessagesService.list(req.query as never);
    sendSuccess(res, result);
  }),

  getDetail: asyncHandler(async (req: Request, res: Response) => {
    const message = await platformContactMessagesService.getDetail(req.params.id!);
    sendSuccess(res, { message });
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const message = await platformContactMessagesService.updateStatus(req.user!.id, req.params.id!, req.body);
    sendSuccess(res, { message }, { message: 'Contact message updated' });
  }),
};
