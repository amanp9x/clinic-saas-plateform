import { Router } from 'express';
import { UserRole, blockedSlotCreateSchema, blockedSlotParamSchema, clinicIdQuerySchema } from '@clinic/shared';
import { blockedSlotsController } from './blocked-slots.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const blockedSlotsRouter = Router();

blockedSlotsRouter.use(
  authenticate,
  authorize(UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.CLINIC_STAFF, UserRole.CLINIC_ADMIN),
);

blockedSlotsRouter.get('/', validate({ query: clinicIdQuerySchema }), blockedSlotsController.list);
blockedSlotsRouter.post('/', validate({ body: blockedSlotCreateSchema }), blockedSlotsController.create);
blockedSlotsRouter.delete(
  '/:id',
  validate({ params: blockedSlotParamSchema, query: clinicIdQuerySchema }),
  blockedSlotsController.unblock,
);
