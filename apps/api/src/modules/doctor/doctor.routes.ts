import { Router } from 'express';
import { UserRole } from '@clinic/shared';
import {
  clinicAssociationUpdateSchema,
  clinicIdParamSchema,
  doctorProfileUpdateSchema,
  doctorStatusUpdateSchema,
  doctorWaitlistQuerySchema,
  earningsQuerySchema,
  idParamSchema,
  leaveCreateSchema,
  reviewRespondSchema,
  scheduleSlotCreateSchema,
  scheduleSlotUpdateSchema,
} from '@clinic/shared';
import { doctorController } from './doctor.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { uploadImage } from '../../middleware/upload.js';

export const doctorRouter = Router();

doctorRouter.use(authenticate, authorize(UserRole.DOCTOR));

doctorRouter.get('/dashboard', doctorController.getDashboard);

doctorRouter.get('/profile', doctorController.getProfile);
doctorRouter.patch('/profile', validate({ body: doctorProfileUpdateSchema }), doctorController.updateProfile);
doctorRouter.post('/profile/photo', uploadImage.single('photo'), doctorController.uploadPhoto);
doctorRouter.delete('/profile/photo', doctorController.removePhoto);

doctorRouter.get('/clinics', doctorController.listClinics);
doctorRouter.patch(
  '/clinics/:clinicId',
  validate({ params: clinicIdParamSchema, body: clinicAssociationUpdateSchema }),
  doctorController.updateClinicAssociation,
);

doctorRouter.get('/schedule', doctorController.listSchedule);
doctorRouter.post('/schedule', validate({ body: scheduleSlotCreateSchema }), doctorController.createScheduleSlot);
doctorRouter.patch(
  '/schedule/:id',
  validate({ params: idParamSchema, body: scheduleSlotUpdateSchema }),
  doctorController.updateScheduleSlot,
);
doctorRouter.delete('/schedule/:id', validate({ params: idParamSchema }), doctorController.deleteScheduleSlot);

doctorRouter.get('/leaves', doctorController.listLeaves);
doctorRouter.post('/leaves', validate({ body: leaveCreateSchema }), doctorController.createLeave);
doctorRouter.delete('/leaves/:id', validate({ params: idParamSchema }), doctorController.deleteLeave);

doctorRouter.get('/status', doctorController.getStatus);
doctorRouter.patch('/status', validate({ body: doctorStatusUpdateSchema }), doctorController.updateStatus);

doctorRouter.get('/earnings', validate({ query: earningsQuerySchema }), doctorController.getEarnings);

doctorRouter.get('/reviews', doctorController.listReviews);
doctorRouter.post(
  '/reviews/:id/respond',
  validate({ params: idParamSchema, body: reviewRespondSchema }),
  doctorController.respondToReview,
);

doctorRouter.get('/waitlist', validate({ query: doctorWaitlistQuerySchema }), doctorController.listWaitlist);
