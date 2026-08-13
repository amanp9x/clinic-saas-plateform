import { Router } from 'express';
import { UserRole, clinicIdQuerySchema, doctorIdParamSchema, receptionDoctorStatusUpdateSchema, reportsQuerySchema } from '@clinic/shared';
import { receptionController } from './reception.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const receptionRouter = Router();

receptionRouter.use(authenticate, authorize(UserRole.RECEPTIONIST, UserRole.CLINIC_STAFF, UserRole.CLINIC_ADMIN));

receptionRouter.get('/clinics', receptionController.listMyClinics);
receptionRouter.get('/dashboard', validate({ query: clinicIdQuerySchema }), receptionController.dashboard);
receptionRouter.get('/doctors/status', validate({ query: clinicIdQuerySchema }), receptionController.listDoctorStatuses);
receptionRouter.patch(
  '/doctors/:doctorId/status',
  validate({ params: doctorIdParamSchema, body: receptionDoctorStatusUpdateSchema }),
  receptionController.updateDoctorStatus,
);
receptionRouter.get('/reports', validate({ query: reportsQuerySchema }), receptionController.reports);
