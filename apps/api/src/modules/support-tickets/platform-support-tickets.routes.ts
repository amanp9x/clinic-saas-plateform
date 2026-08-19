import { Router } from 'express';
import { UserRole, adminUpdateSupportTicketStatusSchema, idParamSchema, platformSupportTicketsQuerySchema, supportTicketMessageSchema } from '@clinic/shared';
import { platformSupportTicketsController } from './platform-support-tickets.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const platformSupportTicketsRouter = Router();

// Role-gated only, same as platformAdminRouter — SUPER_ADMIN/PLATFORM_ADMIN operate across every
// clinic by definition, so there is no clinic-scoping check here.
platformSupportTicketsRouter.use(authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN));

platformSupportTicketsRouter.get('/', validate({ query: platformSupportTicketsQuerySchema }), platformSupportTicketsController.list);
platformSupportTicketsRouter.get('/:id', validate({ params: idParamSchema }), platformSupportTicketsController.getDetail);
platformSupportTicketsRouter.patch('/:id/status', validate({ params: idParamSchema, body: adminUpdateSupportTicketStatusSchema }), platformSupportTicketsController.updateStatus);
platformSupportTicketsRouter.post('/:id/messages', validate({ params: idParamSchema, body: supportTicketMessageSchema }), platformSupportTicketsController.addMessage);
