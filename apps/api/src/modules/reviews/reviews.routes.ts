import { Router } from 'express';
import { UserRole } from '@clinic/shared';
import {
  createReviewSchema,
  updateReviewSchema,
  reviewIdParamSchema,
  eligibilityQuerySchema,
  myReviewsQuerySchema,
} from '@clinic/shared';
import { reviewsController } from './reviews.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const reviewsRouter = Router();

reviewsRouter.use(authenticate, authorize(UserRole.PATIENT));

reviewsRouter.get('/eligible', validate({ query: eligibilityQuerySchema }), reviewsController.checkEligibility);
reviewsRouter.get('/my', validate({ query: myReviewsQuerySchema }), reviewsController.listMy);
reviewsRouter.post('/', validate({ body: createReviewSchema }), reviewsController.create);
reviewsRouter.patch('/:id', validate({ params: reviewIdParamSchema, body: updateReviewSchema }), reviewsController.update);
reviewsRouter.delete('/:id', validate({ params: reviewIdParamSchema }), reviewsController.remove);
