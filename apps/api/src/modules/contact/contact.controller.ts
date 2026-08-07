import type { Request, Response } from 'express';
import { contactRepository } from './contact.repository.js';
import { recordAuditLog } from '../../utils/audit-log.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const contactController = {
  submit: asyncHandler(async (req: Request, res: Response) => {
    const message = await contactRepository.create(req.body);
    recordAuditLog({
      actorUserId: null,
      action: 'contact.message_submitted',
      entityType: 'ContactMessage',
      entityId: message.id,
      ipAddress: req.ip,
    });
    sendSuccess(res, null, {
      status: 201,
      message: "Thanks for reaching out — we'll get back to you soon.",
    });
  }),
};
