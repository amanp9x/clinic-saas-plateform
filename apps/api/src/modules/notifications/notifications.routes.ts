import { Router } from 'express';
import { UserRole } from '@clinic/shared';
import { notificationListQuerySchema, notificationPreferenceSchema } from '@clinic/shared';
import { notificationsController } from './notifications.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const notificationsRouter = Router();

notificationsRouter.use(authenticate, authorize(UserRole.PATIENT));

notificationsRouter.get(
  '/',
  validate({ query: notificationListQuerySchema }),
  notificationsController.list,
);
notificationsRouter.get('/unread-count', notificationsController.unreadCount);
notificationsRouter.post('/:id/read', notificationsController.markRead);
notificationsRouter.post('/read-all', notificationsController.markAllRead);
notificationsRouter.get('/preferences', notificationsController.getPreferences);
notificationsRouter.put(
  '/preferences',
  validate({ body: notificationPreferenceSchema }),
  notificationsController.updatePreferences,
);
