import { Router } from 'express';
import { UserRole, idParamSchema, refillRequestCreateSchema, refillRequestListQuerySchema, refillRequestRespondSchema } from '@clinic/shared';
import { prescriptionRefillController } from './prescription-refill.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

/** Patient-facing: requesting a refill of one's own finalized prescription. Mounted at
 * `/prescriptions` — deliberately separate from the read-only `/medical-records` namespace, which
 * this action isn't part of. */
export const prescriptionRefillRouter = Router();
prescriptionRefillRouter.use(authenticate, authorize(UserRole.PATIENT));

prescriptionRefillRouter.get('/refill-requests', validate({ query: refillRequestListQuerySchema }), prescriptionRefillController.listForPatient);
prescriptionRefillRouter.post(
  '/:id/refill-requests',
  validate({ params: idParamSchema, body: refillRequestCreateSchema }),
  prescriptionRefillController.create,
);

/** Doctor-facing: reviewing and responding to refill requests for prescriptions they issued.
 * Mounted at `/doctor/refill-requests`. */
export const doctorRefillRequestsRouter = Router();
doctorRefillRequestsRouter.use(authenticate, authorize(UserRole.DOCTOR));

doctorRefillRequestsRouter.get('/', validate({ query: refillRequestListQuerySchema }), prescriptionRefillController.listForDoctor);
doctorRefillRequestsRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: refillRequestRespondSchema }),
  prescriptionRefillController.respond,
);
