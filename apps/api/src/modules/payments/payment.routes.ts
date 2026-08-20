import { Router } from 'express';
import { UserRole, collectCounterPaymentSchema, createPaymentOrderSchema, paymentIdParamSchema, paymentListQuerySchema, refundPaymentSchema, verifyPaymentSchema } from '@clinic/shared';
import { paymentController } from './payment.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { paymentSensitiveRateLimiter } from '../../middleware/rate-limit.js';

export const paymentsRouter = Router();

paymentsRouter.use(authenticate);

const CLINIC_VIEWER_ROLES = [UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.CLINIC_STAFF, UserRole.CLINIC_ADMIN, UserRole.PATIENT];

paymentsRouter.post(
  '/create-order',
  authorize(UserRole.PATIENT),
  paymentSensitiveRateLimiter,
  validate({ body: createPaymentOrderSchema }),
  paymentController.createOrder,
);
paymentsRouter.post(
  '/:id/retry',
  authorize(UserRole.PATIENT),
  paymentSensitiveRateLimiter,
  validate({ params: paymentIdParamSchema }),
  paymentController.retryOrder,
);
paymentsRouter.post(
  '/:id/simulate',
  authorize(UserRole.PATIENT),
  validate({ params: paymentIdParamSchema }),
  paymentController.simulateCheckout,
);
paymentsRouter.post(
  '/verify',
  authorize(UserRole.PATIENT),
  paymentSensitiveRateLimiter,
  validate({ body: verifyPaymentSchema }),
  paymentController.verify,
);
paymentsRouter.get('/', authorize(UserRole.PATIENT), validate({ query: paymentListQuerySchema }), paymentController.list);

// Ownership/clinic-authorization for these three is enforced inside payment.engine.ts (patient
// owns it, or doctor/clinic-staff is authorized for that clinic) — role gate here is intentionally
// broad, matching the "no IDOR" requirement being satisfied at the data layer, not the route layer.
paymentsRouter.get('/:id', authorize(...CLINIC_VIEWER_ROLES), validate({ params: paymentIdParamSchema }), paymentController.getById);
paymentsRouter.get('/:id/status', authorize(...CLINIC_VIEWER_ROLES), validate({ params: paymentIdParamSchema }), paymentController.getStatus);
paymentsRouter.get('/:id/receipt', authorize(...CLINIC_VIEWER_ROLES), validate({ params: paymentIdParamSchema }), paymentController.getReceipt);

paymentsRouter.post(
  '/:id/refund',
  authorize(UserRole.RECEPTIONIST, UserRole.CLINIC_STAFF, UserRole.CLINIC_ADMIN),
  paymentSensitiveRateLimiter,
  validate({ params: paymentIdParamSchema, body: refundPaymentSchema }),
  paymentController.refund,
);

paymentsRouter.post(
  '/collect',
  authorize(UserRole.RECEPTIONIST, UserRole.CLINIC_STAFF, UserRole.CLINIC_ADMIN),
  paymentSensitiveRateLimiter,
  validate({ body: collectCounterPaymentSchema }),
  paymentController.collectCounterPayment,
);
