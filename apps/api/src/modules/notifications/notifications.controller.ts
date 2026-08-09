import type { Request, Response } from 'express';
import { notificationsService } from './notifications.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const notificationsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await notificationsService.list(req.user!.id, req.query as never);
    sendSuccess(res, result);
  }),

  unreadCount: asyncHandler(async (req: Request, res: Response) => {
    const count = await notificationsService.countUnread(req.user!.id);
    sendSuccess(res, { count });
  }),

  markRead: asyncHandler(async (req: Request, res: Response) => {
    await notificationsService.markRead(req.user!.id, req.params.id!);
    sendSuccess(res, null, { message: 'Notification marked as read' });
  }),

  markAllRead: asyncHandler(async (req: Request, res: Response) => {
    await notificationsService.markAllRead(req.user!.id);
    sendSuccess(res, null, { message: 'All notifications marked as read' });
  }),

  getPreferences: asyncHandler(async (req: Request, res: Response) => {
    const preferences = await notificationsService.getPreference(req.user!.id);
    sendSuccess(res, { preferences });
  }),

  updatePreferences: asyncHandler(async (req: Request, res: Response) => {
    const preferences = await notificationsService.updatePreference(req.user!.id, req.body);
    sendSuccess(res, { preferences }, { message: 'Notification preferences updated' });
  }),
};
