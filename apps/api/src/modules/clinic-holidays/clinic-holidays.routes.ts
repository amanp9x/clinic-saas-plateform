import { Router } from 'express';
import { UserRole, clinicIdQuerySchema, holidayCreateSchema, idParamSchema } from '@clinic/shared';
import { clinicHolidaysController } from './clinic-holidays.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const clinicHolidaysRouter = Router();

clinicHolidaysRouter.use(authenticate, authorize(UserRole.CLINIC_ADMIN, UserRole.CLINIC_STAFF, UserRole.RECEPTIONIST));

clinicHolidaysRouter.get('/', validate({ query: clinicIdQuerySchema }), clinicHolidaysController.list);
clinicHolidaysRouter.post('/', validate({ body: holidayCreateSchema }), clinicHolidaysController.create);
clinicHolidaysRouter.delete('/:id', validate({ params: idParamSchema, query: clinicIdQuerySchema }), clinicHolidaysController.remove);
