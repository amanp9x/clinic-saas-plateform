import { Router } from 'express';
import { contactMessageSchema } from '@clinic/shared';
import { contactController } from './contact.controller.js';
import { validate } from '../../middleware/validate.js';
import { authRateLimiter } from '../../middleware/rate-limit.js';

export const contactRouter = Router();

contactRouter.post(
  '/',
  authRateLimiter,
  validate({ body: contactMessageSchema }),
  contactController.submit,
);
