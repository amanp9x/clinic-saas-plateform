import { Router } from 'express';
import { UserRole } from '@clinic/shared';
import {
  clinicIdQuerySchema,
  delayUpdateSchema,
  queueCallNextSchema,
  queueRepeatCallSchema,
  queueSessionActionSchema,
  queueSkipSchema,
} from '@clinic/shared';
import { queueController } from './queue.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const queueRouter = Router();

queueRouter.use(authenticate, authorize(UserRole.DOCTOR));

queueRouter.get('/', validate({ query: clinicIdQuerySchema }), queueController.getSnapshot);
queueRouter.post('/session/start', validate({ body: queueSessionActionSchema }), queueController.startSession);
queueRouter.post('/session/pause', validate({ body: queueSessionActionSchema }), queueController.pauseSession);
queueRouter.post('/session/resume', validate({ body: queueSessionActionSchema }), queueController.resumeSession);
queueRouter.post('/call-next', validate({ body: queueCallNextSchema }), queueController.callNext);
queueRouter.post('/repeat-call', validate({ body: queueRepeatCallSchema }), queueController.repeatCall);
queueRouter.post('/skip', validate({ body: queueSkipSchema }), queueController.skip);
queueRouter.patch('/delay', validate({ body: delayUpdateSchema }), queueController.updateDelay);
