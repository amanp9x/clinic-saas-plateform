import { Router } from 'express';
import { UserRole, createSupportTicketSchema, idParamSchema, mySupportTicketsQuerySchema, supportTicketMessageSchema } from '@clinic/shared';
import { supportTicketController } from './support-ticket.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const supportTicketRouter = Router();

supportTicketRouter.use(authenticate, authorize(UserRole.PATIENT));

supportTicketRouter.post('/', validate({ body: createSupportTicketSchema }), supportTicketController.create);
supportTicketRouter.get('/', validate({ query: mySupportTicketsQuerySchema }), supportTicketController.listMy);
supportTicketRouter.get('/:id', validate({ params: idParamSchema }), supportTicketController.getMyDetail);
supportTicketRouter.post('/:id/messages', validate({ params: idParamSchema, body: supportTicketMessageSchema }), supportTicketController.addMyMessage);
supportTicketRouter.patch('/:id/withdraw', validate({ params: idParamSchema }), supportTicketController.withdraw);
supportTicketRouter.patch('/:id/reopen', validate({ params: idParamSchema }), supportTicketController.reopen);
