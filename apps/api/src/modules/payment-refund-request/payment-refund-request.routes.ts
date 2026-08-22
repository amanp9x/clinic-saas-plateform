import { Router } from 'express';
import { UserRole, approveRefundRequestSchema, clinicRefundRequestsQuerySchema, createRefundRequestSchema, idParamSchema, paymentIdParamSchema, rejectRefundRequestSchema } from '@clinic/shared';
import { refundRequestController } from './payment-refund-request.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { paymentSensitiveRateLimiter } from '../../middleware/rate-limit.js';

/** Patient-facing: requesting a refund for one's own captured payment. Mounted at the shared
 * `/payments` prefix in routes/index.ts, alongside (not inside) the existing `paymentsRouter` —
 * same file-per-workflow separation Phase 21/25 already established for refill/settlement
 * requests. `authorize(PATIENT)` MUST be applied per-route here, not via a router-level `.use()`
 * — a blanket `.use()` on a shared, non-exclusive mount prefix runs for every request that
 * reaches this router regardless of whether any route inside it actually matches, which would
 * incorrectly 403 every staff call to the pre-existing `/payments/:id/refund` endpoint before it
 * ever reaches `paymentsRouter`. `authenticate` alone is safe to keep blanket since it never
 * rejects by role. */
export const patientRefundRequestRouter = Router();
patientRefundRequestRouter.use(authenticate);
patientRefundRequestRouter.post(
  '/:id/refund-request',
  authorize(UserRole.PATIENT),
  paymentSensitiveRateLimiter,
  validate({ params: paymentIdParamSchema, body: createRefundRequestSchema }),
  refundRequestController.request,
);

/** Clinic-staff-facing: reviewing refund requests for their own clinic. Registered under the more
 * specific `/payments/refund-requests` prefix, mounted before the general `/payments` router in
 * routes/index.ts — same prefix-ordering convention already used for `/payments/webhooks`. */
export const clinicRefundRequestRouter = Router();
clinicRefundRequestRouter.use(authenticate, authorize(UserRole.RECEPTIONIST, UserRole.CLINIC_STAFF, UserRole.CLINIC_ADMIN));

clinicRefundRequestRouter.get('/', validate({ query: clinicRefundRequestsQuerySchema }), refundRequestController.listForClinic);
clinicRefundRequestRouter.patch('/:id/approve', validate({ params: idParamSchema, body: approveRefundRequestSchema }), refundRequestController.approve);
clinicRefundRequestRouter.patch('/:id/reject', validate({ params: idParamSchema, body: rejectRefundRequestSchema }), refundRequestController.reject);
