import { Router } from 'express';
import {
  UserRole,
  clinicIdQuerySchema,
  clinicProfileUpdateSchema,
  clinicSettingsUpdateSchema,
  clinicStatusUpdateSchema,
  clinicVerificationSubmitSchema,
  documentUploadSchema,
  idParamSchema,
} from '@clinic/shared';
import { clinicController } from './clinic.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { uploadDocument } from '../../middleware/upload.js';

export const clinicRouter = Router();

clinicRouter.use(authenticate, authorize(UserRole.CLINIC_ADMIN, UserRole.CLINIC_STAFF, UserRole.RECEPTIONIST));

clinicRouter.get('/dashboard', validate({ query: clinicIdQuerySchema }), clinicController.getDashboard);

clinicRouter.get('/profile', validate({ query: clinicIdQuerySchema }), clinicController.getProfile);
clinicRouter.patch('/profile', validate({ body: clinicProfileUpdateSchema }), clinicController.updateProfile);

clinicRouter.post('/verification', validate({ body: clinicVerificationSubmitSchema }), clinicController.submitVerification);
clinicRouter.patch('/status', validate({ body: clinicStatusUpdateSchema }), clinicController.updateStatus);

clinicRouter.get('/settings', validate({ query: clinicIdQuerySchema }), clinicController.getSettings);
clinicRouter.patch('/settings', validate({ body: clinicSettingsUpdateSchema }), clinicController.updateSettings);

clinicRouter.get('/documents', validate({ query: clinicIdQuerySchema }), clinicController.listDocuments);
clinicRouter.post(
  '/documents',
  uploadDocument.single('file'),
  validate({ body: documentUploadSchema }),
  clinicController.uploadDocument,
);
clinicRouter.get(
  '/documents/:id/download',
  validate({ params: idParamSchema, query: clinicIdQuerySchema }),
  clinicController.downloadDocument,
);
clinicRouter.delete('/documents/:id', validate({ params: idParamSchema, query: clinicIdQuerySchema }), clinicController.deleteDocument);
