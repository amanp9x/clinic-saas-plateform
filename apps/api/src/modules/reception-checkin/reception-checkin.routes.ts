import { Router } from 'express';
import { UserRole, checkInSchema, walkInCreateSchema } from '@clinic/shared';
import { receptionCheckinController } from './reception-checkin.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const receptionCheckinRouter = Router();

receptionCheckinRouter.use(authenticate, authorize(UserRole.RECEPTIONIST, UserRole.CLINIC_STAFF, UserRole.CLINIC_ADMIN));

receptionCheckinRouter.post('/checkin', validate({ body: checkInSchema }), receptionCheckinController.checkIn);
receptionCheckinRouter.post('/walkin', validate({ body: walkInCreateSchema }), receptionCheckinController.walkIn);
