import type { Request, Response } from 'express';
import { supportTicketService } from './support-ticket.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const supportTicketController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const ticket = await supportTicketService.create(req.user!.id, req.body);
    sendSuccess(res, { ticket }, { status: 201, message: 'Support ticket submitted' });
  }),

  listMy: asyncHandler(async (req: Request, res: Response) => {
    const result = await supportTicketService.listMy(req.user!.id, req.query as never);
    sendSuccess(res, result);
  }),

  getMyDetail: asyncHandler(async (req: Request, res: Response) => {
    const ticket = await supportTicketService.getMyDetail(req.user!.id, req.params.id!);
    sendSuccess(res, { ticket });
  }),

  addMyMessage: asyncHandler(async (req: Request, res: Response) => {
    const ticket = await supportTicketService.addMyMessage(req.user!.id, req.params.id!, req.body);
    sendSuccess(res, { ticket }, { message: 'Message sent' });
  }),

  withdraw: asyncHandler(async (req: Request, res: Response) => {
    const ticket = await supportTicketService.withdraw(req.user!.id, req.params.id!);
    sendSuccess(res, { ticket }, { message: 'Ticket withdrawn' });
  }),

  reopen: asyncHandler(async (req: Request, res: Response) => {
    const ticket = await supportTicketService.reopen(req.user!.id, req.params.id!);
    sendSuccess(res, { ticket }, { message: 'Ticket reopened' });
  }),
};
