import type { Request, Response } from 'express';
import { clinicAnnouncementService } from './clinic-announcement.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const clinicAnnouncementController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const result = await clinicAnnouncementService.create(req.user!.id, req.user!.role, req.body);
    sendSuccess(res, result, { status: 201, message: 'Announcement sent' });
  }),
};
