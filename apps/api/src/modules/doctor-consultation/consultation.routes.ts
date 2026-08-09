import { Router } from 'express';
import { UserRole } from '@clinic/shared';
import { appointmentIdParamSchema, consultationUpsertSchema } from '@clinic/shared';
import { consultationController } from './consultation.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const consultationRouter = Router();

consultationRouter.use(authenticate, authorize(UserRole.DOCTOR));

consultationRouter.get('/:appointmentId', validate({ params: appointmentIdParamSchema }), consultationController.get);
consultationRouter.put(
  '/:appointmentId',
  validate({ params: appointmentIdParamSchema, body: consultationUpsertSchema }),
  consultationController.upsert,
);
consultationRouter.post(
  '/:appointmentId/complete',
  validate({ params: appointmentIdParamSchema }),
  consultationController.complete,
);
