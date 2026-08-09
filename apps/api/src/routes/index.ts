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
import { doctorRouter } from '../modules/doctor/doctor.routes.js';
import { doctorAppointmentsRouter } from '../modules/doctor-appointments/doctor-appointments.routes.js';
import { doctorPatientsRouter } from '../modules/doctor-patients/doctor-patients.routes.js';
import { queueRouter } from '../modules/doctor-queue/queue.routes.js';
import { consultationRouter } from '../modules/doctor-consultation/consultation.routes.js';
import { prescriptionRouter, signatureRouter } from '../modules/doctor-prescription/prescription.routes.js';

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

// --- Doctor Portal (Phase 4) -------------------------------------------------
apiRouter.use('/doctor', doctorRouter);
apiRouter.use('/doctor/appointments', doctorAppointmentsRouter);
apiRouter.use('/doctor/patients', doctorPatientsRouter);
apiRouter.use('/doctor/queue', queueRouter);
apiRouter.use('/doctor/consultations', consultationRouter);
apiRouter.use('/doctor/prescriptions', prescriptionRouter);
apiRouter.use('/doctor/settings/signature', signatureRouter);
