import { Router } from 'express';
import { UserRole } from '@clinic/shared';
import { medicalRecordsController } from './medical-records.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';

export const medicalRecordsRouter = Router();

medicalRecordsRouter.use(authenticate, authorize(UserRole.PATIENT));

medicalRecordsRouter.get('/history', medicalRecordsController.history);
medicalRecordsRouter.get('/prescriptions', medicalRecordsController.prescriptions);
medicalRecordsRouter.get('/reports', medicalRecordsController.labReports);
medicalRecordsRouter.get('/vaccinations', medicalRecordsController.vaccinations);
medicalRecordsRouter.get('/vitals', medicalRecordsController.vitals);
medicalRecordsRouter.get('/downloads', medicalRecordsController.downloads);
