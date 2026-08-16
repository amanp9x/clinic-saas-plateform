import { Router } from 'express';
import { UserRole } from '@clinic/shared';
import { notificationPreferenceSchema } from '@clinic/shared';
import { notificationsController } from './notifications.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const notificationPreferencesRouter = Router();

notificationPreferencesRouter.use(
  authenticate,
  authorize(UserRole.PATIENT, UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.CLINIC_STAFF, UserRole.CLINIC_ADMIN),
);

notificationPreferencesRouter.get('/', notificationsController.getPreferences);
notificationPreferencesRouter.patch('/', validate({ body: notificationPreferenceSchema }), notificationsController.updatePreferences);
