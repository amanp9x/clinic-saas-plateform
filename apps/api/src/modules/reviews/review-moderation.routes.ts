import { Router } from 'express';
import { UserRole } from '@clinic/shared';
import { moderationQueueQuerySchema, moderateReviewSchema, reviewResponseSchema, reviewIdParamSchema } from '@clinic/shared';
import { reviewModerationController } from './review-moderation.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const reviewModerationRouter = Router();

// Reception/clinic-staff get here only if explicitly granted REVIEW_MODERATE (checked inside the
// service, per-clinic, via assertClinicPermission) — never automatically, per spec section 12.
reviewModerationRouter.use(authenticate, authorize(UserRole.RECEPTIONIST, UserRole.CLINIC_STAFF, UserRole.CLINIC_ADMIN));

reviewModerationRouter.get('/', validate({ query: moderationQueueQuerySchema }), reviewModerationController.list);
reviewModerationRouter.get('/:id', validate({ params: reviewIdParamSchema }), reviewModerationController.getById);
reviewModerationRouter.patch('/:id/status', validate({ params: reviewIdParamSchema, body: moderateReviewSchema }), reviewModerationController.updateStatus);
reviewModerationRouter.post('/:id/respond', validate({ params: reviewIdParamSchema, body: reviewResponseSchema }), reviewModerationController.respond);
