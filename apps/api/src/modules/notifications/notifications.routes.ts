import { Router } from 'express';
import { UserRole } from '@clinic/shared';
import { notificationListQuerySchema, notificationIdParamSchema } from '@clinic/shared';
import { notificationsController } from './notifications.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const notificationsRouter = Router();

// Generic on userId — every authenticated role has its own notification inbox.
notificationsRouter.use(
  authenticate,
  authorize(UserRole.PATIENT, UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.CLINIC_STAFF, UserRole.CLINIC_ADMIN),
);

notificationsRouter.get('/', validate({ query: notificationListQuerySchema }), notificationsController.list);
notificationsRouter.get('/unread-count', notificationsController.unreadCount);
notificationsRouter.patch('/read-all', notificationsController.markAllRead);
notificationsRouter.patch('/:id/read', validate({ params: notificationIdParamSchema }), notificationsController.markRead);
notificationsRouter.delete('/:id', validate({ params: notificationIdParamSchema }), notificationsController.remove);
