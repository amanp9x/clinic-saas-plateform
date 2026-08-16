import { Router } from 'express';
import { UserRole, clinicAnnouncementSchema } from '@clinic/shared';
import { clinicAnnouncementController } from './clinic-announcement.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const clinicAnnouncementRouter = Router();

clinicAnnouncementRouter.use(authenticate, authorize(UserRole.RECEPTIONIST, UserRole.CLINIC_STAFF, UserRole.CLINIC_ADMIN));
clinicAnnouncementRouter.post('/', validate({ body: clinicAnnouncementSchema }), clinicAnnouncementController.create);
