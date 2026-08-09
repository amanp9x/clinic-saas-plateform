import { Router } from 'express';
import { UserRole } from '@clinic/shared';
import { appointmentListQuerySchema, cancelAppointmentSchema } from '@clinic/shared';
import { appointmentsController } from './appointments.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const appointmentsRouter = Router();

appointmentsRouter.use(authenticate, authorize(UserRole.PATIENT));

appointmentsRouter.get('/', validate({ query: appointmentListQuerySchema }), appointmentsController.list);
appointmentsRouter.get('/:id', appointmentsController.getById);
appointmentsRouter.get('/:id/queue', appointmentsController.getQueueView);
appointmentsRouter.post(
  '/:id/cancel',
  validate({ body: cancelAppointmentSchema }),
  appointmentsController.cancel,
);
