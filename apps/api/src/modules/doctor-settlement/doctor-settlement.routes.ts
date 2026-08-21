import { Router } from 'express';
import {
  UserRole,
  approveSettlementSchema,
  doctorSettlementsQuerySchema,
  idParamSchema,
  markSettlementPaidSchema,
  platformSettlementsQuerySchema,
  rejectSettlementSchema,
  requestSettlementSchema,
} from '@clinic/shared';
import { doctorSettlementController } from './doctor-settlement.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

/** Doctor-facing: requesting settlement of one's own unsettled earnings. */
export const doctorSettlementRouter = Router();
doctorSettlementRouter.use(authenticate, authorize(UserRole.DOCTOR));

doctorSettlementRouter.get('/', validate({ query: doctorSettlementsQuerySchema }), doctorSettlementController.listForDoctor);
doctorSettlementRouter.post('/', validate({ body: requestSettlementSchema }), doctorSettlementController.request);

/** Platform-admin-facing: reviewing and resolving settlement requests across every doctor. Role-
 * gated only, same as platform-support-tickets/platform-contact-messages — SUPER_ADMIN/
 * PLATFORM_ADMIN operate across every clinic/doctor by definition, so there is no clinic-scoping
 * check here (earnings themselves are doctor-wide, not clinic-scoped — see doctor.service.ts). */
export const platformSettlementRouter = Router();
platformSettlementRouter.use(authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN));

platformSettlementRouter.get('/', validate({ query: platformSettlementsQuerySchema }), doctorSettlementController.listForPlatform);
platformSettlementRouter.get('/:id', validate({ params: idParamSchema }), doctorSettlementController.getDetailForPlatform);
platformSettlementRouter.patch('/:id/approve', validate({ params: idParamSchema, body: approveSettlementSchema }), doctorSettlementController.approve);
platformSettlementRouter.patch('/:id/reject', validate({ params: idParamSchema, body: rejectSettlementSchema }), doctorSettlementController.reject);
platformSettlementRouter.patch('/:id/mark-paid', validate({ params: idParamSchema, body: markSettlementPaidSchema }), doctorSettlementController.markPaid);
