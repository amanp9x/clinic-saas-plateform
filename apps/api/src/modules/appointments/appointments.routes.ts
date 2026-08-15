import { Router } from 'express';
import { UserRole } from '@clinic/shared';
import {
  appointmentListQuerySchema,
  availabilityQuerySchema,
  cancelAppointmentSchema,
  createAppointmentSchema,
  holdParamSchema,
  holdSlotSchema,
  rescheduleAppointmentSchema,
} from '@clinic/shared';
import { appointmentsController } from './appointments.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const appointmentsRouter = Router();

// Public — no private data leaked (see booking.availability.ts, which never queries Patient).
// Must be registered before the router-wide auth gate below, and before `/:id`-shaped routes.
appointmentsRouter.get(
  '/availability',
  validate({ query: availabilityQuerySchema }),
  appointmentsController.getAvailability,
);

appointmentsRouter.use(authenticate, authorize(UserRole.PATIENT));

appointmentsRouter.get('/', validate({ query: appointmentListQuerySchema }), appointmentsController.list);
appointmentsRouter.post('/hold', validate({ body: holdSlotSchema }), appointmentsController.holdSlot);
appointmentsRouter.delete('/hold/:id', validate({ params: holdParamSchema }), appointmentsController.releaseHold);
appointmentsRouter.post('/', validate({ body: createAppointmentSchema }), appointmentsController.create);
appointmentsRouter.get('/:id', appointmentsController.getById);
appointmentsRouter.get('/:id/queue', appointmentsController.getQueueView);
appointmentsRouter.patch(
  '/:id/reschedule',
  validate({ body: rescheduleAppointmentSchema }),
  appointmentsController.reschedule,
);
appointmentsRouter.post(
  '/:id/cancel',
  validate({ body: cancelAppointmentSchema }),
  appointmentsController.cancel,
);
