import { Router } from 'express';
import { UserRole } from '@clinic/shared';
import {
  idParamSchema,
  prescriptionCreateSchema,
  prescriptionListQuerySchema,
  prescriptionUpdateSchema,
  signatureUpsertSchema,
} from '@clinic/shared';
import { prescriptionController } from './prescription.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { uploadImage } from '../../middleware/upload.js';

export const prescriptionRouter = Router();
prescriptionRouter.use(authenticate, authorize(UserRole.DOCTOR));

prescriptionRouter.get('/', validate({ query: prescriptionListQuerySchema }), prescriptionController.list);
prescriptionRouter.get('/:id', validate({ params: idParamSchema }), prescriptionController.getById);
prescriptionRouter.post('/', validate({ body: prescriptionCreateSchema }), prescriptionController.create);
prescriptionRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: prescriptionUpdateSchema }),
  prescriptionController.update,
);
prescriptionRouter.post('/:id/finalize', validate({ params: idParamSchema }), prescriptionController.finalize);
prescriptionRouter.get('/:id/pdf', validate({ params: idParamSchema }), prescriptionController.getPdf);

export const signatureRouter = Router();
signatureRouter.use(authenticate, authorize(UserRole.DOCTOR));

signatureRouter.get('/', prescriptionController.getSignature);
signatureRouter.put('/', validate({ body: signatureUpsertSchema }), prescriptionController.updateSignatureText);
signatureRouter.post('/image', uploadImage.single('signature'), prescriptionController.uploadSignatureImage);
signatureRouter.delete('/image', prescriptionController.removeSignatureImage);
