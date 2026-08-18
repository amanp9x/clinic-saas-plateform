import { Router } from 'express';
import { UserRole, clinicFollowUpsQuerySchema } from '@clinic/shared';
import { clinicFollowUpsController } from './clinic-follow-ups.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const clinicFollowUpsRouter = Router();

clinicFollowUpsRouter.use(authenticate, authorize(UserRole.RECEPTIONIST, UserRole.CLINIC_STAFF, UserRole.CLINIC_ADMIN));

clinicFollowUpsRouter.get('/', validate({ query: clinicFollowUpsQuerySchema }), clinicFollowUpsController.list);
