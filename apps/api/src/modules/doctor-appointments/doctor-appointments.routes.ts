import { Router } from 'express';
import { UserRole } from '@clinic/shared';
import { appointmentSkipSchema, doctorAppointmentListQuerySchema, idParamSchema } from '@clinic/shared';
import { doctorAppointmentsController } from './doctor-appointments.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const doctorAppointmentsRouter = Router();

doctorAppointmentsRouter.use(authenticate, authorize(UserRole.DOCTOR));

doctorAppointmentsRouter.get('/', validate({ query: doctorAppointmentListQuerySchema }), doctorAppointmentsController.list);
doctorAppointmentsRouter.get('/:id', validate({ params: idParamSchema }), doctorAppointmentsController.getById);
doctorAppointmentsRouter.post('/:id/start', validate({ params: idParamSchema }), doctorAppointmentsController.start);
doctorAppointmentsRouter.post('/:id/no-show', validate({ params: idParamSchema }), doctorAppointmentsController.markNoShow);
doctorAppointmentsRouter.post(
  '/:id/skip',
  validate({ params: idParamSchema, body: appointmentSkipSchema }),
  doctorAppointmentsController.skip,
);
