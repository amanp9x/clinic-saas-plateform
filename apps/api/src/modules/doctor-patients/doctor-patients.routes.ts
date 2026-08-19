import { Router } from 'express';
import {
  UserRole,
  labReportCreateSchema,
  labReportUpdateSchema,
  patientEntryIdParamSchema,
  patientIdParamSchema,
  vaccinationCreateSchema,
} from '@clinic/shared';
import { doctorPatientsController } from './doctor-patients.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { uploadDocument } from '../../middleware/upload.js';

export const doctorPatientsRouter = Router();

doctorPatientsRouter.use(authenticate, authorize(UserRole.DOCTOR));

doctorPatientsRouter.get('/:patientId', validate({ params: patientIdParamSchema }), doctorPatientsController.getProfile);
doctorPatientsRouter.get(
  '/:patientId/medical-history',
  validate({ params: patientIdParamSchema }),
  doctorPatientsController.getMedicalHistory,
);

// Phase 18 — Lab Reports & Vaccination entry workflow.
doctorPatientsRouter.post(
  '/:patientId/lab-reports',
  validate({ params: patientIdParamSchema, body: labReportCreateSchema }),
  doctorPatientsController.createLabReport,
);
doctorPatientsRouter.patch(
  '/:patientId/lab-reports/:id',
  uploadDocument.single('file'),
  validate({ params: patientEntryIdParamSchema, body: labReportUpdateSchema }),
  doctorPatientsController.updateLabReport,
);
doctorPatientsRouter.post(
  '/:patientId/vaccinations',
  validate({ params: patientIdParamSchema, body: vaccinationCreateSchema }),
  doctorPatientsController.createVaccination,
);
