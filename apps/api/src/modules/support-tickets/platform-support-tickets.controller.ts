import type { Request, Response } from 'express';
import { platformSupportTicketsService } from './platform-support-tickets.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const platformSupportTicketsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await platformSupportTicketsService.listTickets(req.query as never);
    sendSuccess(res, result);
  }),

  getDetail: asyncHandler(async (req: Request, res: Response) => {
    const ticket = await platformSupportTicketsService.getDetail(req.params.id!);
    sendSuccess(res, { ticket });
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const ticket = await platformSupportTicketsService.updateStatus(req.user!.id, req.params.id!, req.body);
    sendSuccess(res, { ticket }, { message: 'Ticket status updated' });
  }),

  addMessage: asyncHandler(async (req: Request, res: Response) => {
    const ticket = await platformSupportTicketsService.addMessage(req.user!.id, req.params.id!, req.body);
    sendSuccess(res, { ticket }, { message: 'Reply sent' });
  }),
};
