import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes.js';
import { healthRouter } from '../modules/health/health.routes.js';
import { catalogRouter } from '../modules/catalog/catalog.routes.js';
import { contactRouter } from '../modules/contact/contact.routes.js';
import { patientRouter } from '../modules/patient/patient.routes.js';
import { appointmentsRouter } from '../modules/appointments/appointments.routes.js';
import { medicalRecordsRouter } from '../modules/medical-records/medical-records.routes.js';
import { notificationsRouter } from '../modules/notifications/notifications.routes.js';
import { dashboardRouter } from '../modules/dashboard/dashboard.routes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/catalog', catalogRouter);
apiRouter.use('/contact', contactRouter);
apiRouter.use('/patient', patientRouter);
apiRouter.use('/appointments', appointmentsRouter);
apiRouter.use('/medical-records', medicalRecordsRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/dashboard', dashboardRouter);
