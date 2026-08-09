import { Router } from 'express';
import { UserRole } from '@clinic/shared';
import {
  addressSchema,
  changeEmailConfirmSchema,
  changeEmailRequestSchema,
  changeMobileConfirmSchema,
  changeMobileRequestSchema,
  deleteAccountSchema,
  updateProfileSchema,
} from '@clinic/shared';
import { patientController } from './patient.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { authRateLimiter, otpRequestRateLimiter } from '../../middleware/rate-limit.js';
import { uploadImage } from '../../middleware/upload.js';

export const patientRouter = Router();

patientRouter.use(authenticate, authorize(UserRole.PATIENT));

patientRouter.get('/profile', patientController.getProfile);
patientRouter.patch('/profile', validate({ body: updateProfileSchema }), patientController.updateProfile);
patientRouter.post('/profile/photo', uploadImage.single('photo'), patientController.uploadPhoto);
patientRouter.delete('/profile/photo', patientController.removePhoto);

patientRouter.get('/addresses', patientController.listAddresses);
patientRouter.post('/addresses', validate({ body: addressSchema }), patientController.createAddress);
patientRouter.patch('/addresses/:id', validate({ body: addressSchema }), patientController.updateAddress);
patientRouter.delete('/addresses/:id', patientController.deleteAddress);

patientRouter.post(
  '/email/change/request',
  otpRequestRateLimiter,
  validate({ body: changeEmailRequestSchema }),
  patientController.requestEmailChange,
);
patientRouter.post(
  '/email/change/confirm',
  authRateLimiter,
  validate({ body: changeEmailConfirmSchema }),
  patientController.confirmEmailChange,
);

patientRouter.post(
  '/mobile/change/request',
  otpRequestRateLimiter,
  validate({ body: changeMobileRequestSchema }),
  patientController.requestMobileChange,
);
patientRouter.post(
  '/mobile/change/confirm',
  authRateLimiter,
  validate({ body: changeMobileConfirmSchema }),
  patientController.confirmMobileChange,
);

patientRouter.delete(
  '/account',
  authRateLimiter,
  validate({ body: deleteAccountSchema }),
  patientController.deleteAccount,
);
