import { Router } from 'express';
import {
  UserRole,
  receptionQueueActionSchema,
  receptionQueueTokenActionSchema,
  receptionSkipSchema,
  receptionPauseSchema,
  receptionDelayUpdateSchema,
  receptionPriorityUpdateSchema,
  receptionAppointmentActionSchema,
  queueHistoryQuerySchema,
} from '@clinic/shared';
import { receptionQueueController } from './reception-queue.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const receptionQueueRouter = Router();

receptionQueueRouter.use(authenticate, authorize(UserRole.RECEPTIONIST, UserRole.CLINIC_STAFF, UserRole.CLINIC_ADMIN));

receptionQueueRouter.get('/', validate({ query: receptionQueueActionSchema }), receptionQueueController.getSnapshot);
receptionQueueRouter.get('/history', validate({ query: queueHistoryQuerySchema }), receptionQueueController.history);

receptionQueueRouter.post('/call-next', validate({ body: receptionQueueActionSchema }), receptionQueueController.callNext);
receptionQueueRouter.post('/repeat-call', validate({ body: receptionQueueTokenActionSchema }), receptionQueueController.repeatCall);
receptionQueueRouter.post('/skip', validate({ body: receptionSkipSchema }), receptionQueueController.skip);
receptionQueueRouter.post('/session/pause', validate({ body: receptionPauseSchema }), receptionQueueController.pauseSession);
receptionQueueRouter.post('/session/resume', validate({ body: receptionQueueActionSchema }), receptionQueueController.resumeSession);
receptionQueueRouter.post('/mark-in-consultation', validate({ body: receptionAppointmentActionSchema }), receptionQueueController.markInConsultation);
receptionQueueRouter.post('/mark-completed', validate({ body: receptionAppointmentActionSchema }), receptionQueueController.markCompleted);
receptionQueueRouter.post('/no-show', validate({ body: receptionAppointmentActionSchema }), receptionQueueController.markNoShow);

receptionQueueRouter.patch('/delay', validate({ body: receptionDelayUpdateSchema }), receptionQueueController.updateDelay);
receptionQueueRouter.patch('/priority', validate({ body: receptionPriorityUpdateSchema }), receptionQueueController.updatePriority);
