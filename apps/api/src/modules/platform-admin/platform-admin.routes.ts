import { Router } from 'express';
import {
  UserRole,
  clinicDocumentStatusUpdateSchema,
  clinicVerificationUpdateSchema,
  idParamSchema,
  platformClinicDocumentParamSchema,
  platformClinicListQuerySchema,
} from '@clinic/shared';
import { platformAdminController } from './platform-admin.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const platformAdminRouter = Router();

// Role-gated only — SUPER_ADMIN/PLATFORM_ADMIN operate across every clinic by definition, so
// there is no clinic-scoping check here (unlike every other clinic-facing module in this
// codebase), matching the existing PERMISSION_BYPASS_ROLES design in reception.shared.ts.
platformAdminRouter.use(authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN));

platformAdminRouter.get('/overview', platformAdminController.getOverview);
platformAdminRouter.get('/clinics', validate({ query: platformClinicListQuerySchema }), platformAdminController.listClinics);
platformAdminRouter.get('/clinics/:id', validate({ params: idParamSchema }), platformAdminController.getClinicDetail);
platformAdminRouter.patch(
  '/clinics/:id/verification',
  validate({ params: idParamSchema, body: clinicVerificationUpdateSchema }),
  platformAdminController.updateVerification,
);
platformAdminRouter.patch(
  '/clinics/:id/documents/:documentId',
  validate({ params: platformClinicDocumentParamSchema, body: clinicDocumentStatusUpdateSchema }),
  platformAdminController.updateDocumentStatus,
);
