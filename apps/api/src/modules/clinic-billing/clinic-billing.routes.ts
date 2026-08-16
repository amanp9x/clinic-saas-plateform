import { Router } from 'express';
import { UserRole, clinicBillingQuerySchema } from '@clinic/shared';
import { clinicBillingController } from './clinic-billing.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const clinicBillingRouter = Router();

clinicBillingRouter.use(authenticate, authorize(UserRole.RECEPTIONIST, UserRole.CLINIC_STAFF, UserRole.CLINIC_ADMIN));
clinicBillingRouter.get('/', validate({ query: clinicBillingQuerySchema }), clinicBillingController.list);
