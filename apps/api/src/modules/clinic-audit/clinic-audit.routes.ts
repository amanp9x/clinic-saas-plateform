import { Router } from 'express';
import { UserRole, clinicAuditLogQuerySchema } from '@clinic/shared';
import { clinicAuditController } from './clinic-audit.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const clinicAuditRouter = Router();

clinicAuditRouter.use(authenticate, authorize(UserRole.CLINIC_ADMIN, UserRole.CLINIC_STAFF, UserRole.RECEPTIONIST));

clinicAuditRouter.get('/', validate({ query: clinicAuditLogQuerySchema }), clinicAuditController.list);
