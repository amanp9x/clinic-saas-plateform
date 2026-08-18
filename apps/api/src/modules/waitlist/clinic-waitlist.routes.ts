import { Router } from 'express';
import { UserRole, clinicIdQuerySchema, clinicWaitlistQuerySchema, idParamSchema, receptionJoinWaitlistSchema } from '@clinic/shared';
import { clinicWaitlistController } from './clinic-waitlist.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const clinicWaitlistRouter = Router();

clinicWaitlistRouter.use(authenticate, authorize(UserRole.RECEPTIONIST, UserRole.CLINIC_STAFF, UserRole.CLINIC_ADMIN));

clinicWaitlistRouter.get('/', validate({ query: clinicWaitlistQuerySchema }), clinicWaitlistController.list);
clinicWaitlistRouter.post('/', validate({ body: receptionJoinWaitlistSchema }), clinicWaitlistController.add);
clinicWaitlistRouter.delete('/:id', validate({ params: idParamSchema, query: clinicIdQuerySchema }), clinicWaitlistController.cancel);
