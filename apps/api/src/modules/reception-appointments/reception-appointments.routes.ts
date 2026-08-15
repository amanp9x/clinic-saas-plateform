import { Router } from 'express';
import {
  UserRole,
  clinicIdQuerySchema,
  idParamSchema,
  patientIdParamSchema,
  patientSearchQuerySchema,
  receptionAppointmentListQuerySchema,
  receptionCancelAppointmentSchema,
  receptionCreateAppointmentSchema,
  receptionNoShowSchema,
  rescheduleAppointmentSchema,
} from '@clinic/shared';
import { receptionAppointmentsController } from './reception-appointments.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const receptionAppointmentsRouter = Router();

receptionAppointmentsRouter.use(authenticate, authorize(UserRole.RECEPTIONIST, UserRole.CLINIC_STAFF, UserRole.CLINIC_ADMIN));

receptionAppointmentsRouter.get('/appointments', validate({ query: receptionAppointmentListQuerySchema }), receptionAppointmentsController.list);
receptionAppointmentsRouter.post(
  '/appointments',
  validate({ body: receptionCreateAppointmentSchema }),
  receptionAppointmentsController.create,
);
receptionAppointmentsRouter.get(
  '/appointments/:id',
  validate({ params: idParamSchema, query: clinicIdQuerySchema }),
  receptionAppointmentsController.getById,
);
receptionAppointmentsRouter.patch(
  '/appointments/:id/reschedule',
  validate({ params: idParamSchema, query: clinicIdQuerySchema, body: rescheduleAppointmentSchema }),
  receptionAppointmentsController.reschedule,
);
receptionAppointmentsRouter.patch(
  '/appointments/:id/cancel',
  validate({ params: idParamSchema, query: clinicIdQuerySchema, body: receptionCancelAppointmentSchema }),
  receptionAppointmentsController.cancel,
);
receptionAppointmentsRouter.patch(
  '/appointments/:id/no-show',
  validate({ params: idParamSchema, body: receptionNoShowSchema }),
  receptionAppointmentsController.markNoShow,
);
receptionAppointmentsRouter.get('/patients/search', validate({ query: patientSearchQuerySchema }), receptionAppointmentsController.searchPatients);
receptionAppointmentsRouter.get(
  '/patients/:patientId',
  validate({ params: patientIdParamSchema, query: clinicIdQuerySchema }),
  receptionAppointmentsController.quickView,
);
