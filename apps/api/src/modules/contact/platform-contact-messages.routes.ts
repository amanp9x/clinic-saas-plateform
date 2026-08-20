import { Router } from 'express';
import { UserRole, adminUpdateContactMessageStatusSchema, idParamSchema, platformContactMessagesQuerySchema } from '@clinic/shared';
import { platformContactMessagesController } from './platform-contact-messages.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const platformContactMessagesRouter = Router();

// Role-gated only, same as platformSupportTicketsRouter — SUPER_ADMIN/PLATFORM_ADMIN operate
// across every clinic by definition, and contact messages aren't clinic-scoped at all.
platformContactMessagesRouter.use(authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN));

platformContactMessagesRouter.get('/', validate({ query: platformContactMessagesQuerySchema }), platformContactMessagesController.list);
platformContactMessagesRouter.get('/:id', validate({ params: idParamSchema }), platformContactMessagesController.getDetail);
platformContactMessagesRouter.patch(
  '/:id/status',
  validate({ params: idParamSchema, body: adminUpdateContactMessageStatusSchema }),
  platformContactMessagesController.updateStatus,
);
