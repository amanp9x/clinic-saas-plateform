import { Router } from 'express';
import { UserRole, idParamSchema, joinWaitlistSchema, myWaitlistQuerySchema } from '@clinic/shared';
import { waitlistController } from './waitlist.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const waitlistRouter = Router();

waitlistRouter.use(authenticate, authorize(UserRole.PATIENT));

waitlistRouter.get('/my', validate({ query: myWaitlistQuerySchema }), waitlistController.listMy);
waitlistRouter.post('/', validate({ body: joinWaitlistSchema }), waitlistController.join);
waitlistRouter.delete('/:id', validate({ params: idParamSchema }), waitlistController.cancel);
