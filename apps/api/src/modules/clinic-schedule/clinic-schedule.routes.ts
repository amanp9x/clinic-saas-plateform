import { Router } from 'express';
import { UserRole, clinicIdQuerySchema, workingHoursUpdateSchema } from '@clinic/shared';
import { clinicScheduleController } from './clinic-schedule.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const clinicScheduleRouter = Router();

clinicScheduleRouter.use(authenticate, authorize(UserRole.CLINIC_ADMIN, UserRole.CLINIC_STAFF, UserRole.RECEPTIONIST));

clinicScheduleRouter.get('/', validate({ query: clinicIdQuerySchema }), clinicScheduleController.list);
clinicScheduleRouter.put('/', validate({ body: workingHoursUpdateSchema }), clinicScheduleController.upsert);
