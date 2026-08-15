import { Router } from 'express';
import { UserRole, clinicReportsQuerySchema } from '@clinic/shared';
import { clinicReportsController } from './clinic-reports.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const clinicReportsRouter = Router();

clinicReportsRouter.use(authenticate, authorize(UserRole.CLINIC_ADMIN, UserRole.CLINIC_STAFF, UserRole.RECEPTIONIST));

clinicReportsRouter.get('/', validate({ query: clinicReportsQuerySchema }), clinicReportsController.get);
