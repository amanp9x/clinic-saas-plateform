import { Router } from 'express';
import { UserRole } from '@clinic/shared';
import { patientIdParamSchema } from '@clinic/shared';
import { doctorPatientsController } from './doctor-patients.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const doctorPatientsRouter = Router();

doctorPatientsRouter.use(authenticate, authorize(UserRole.DOCTOR));

doctorPatientsRouter.get('/:patientId', validate({ params: patientIdParamSchema }), doctorPatientsController.getProfile);
doctorPatientsRouter.get(
  '/:patientId/medical-history',
  validate({ params: patientIdParamSchema }),
  doctorPatientsController.getMedicalHistory,
);
