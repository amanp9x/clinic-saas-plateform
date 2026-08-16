import { Router } from 'express';
import { webhookProviderParamSchema } from '@clinic/shared';
import { webhookController } from './webhook.controller.js';
import { validate } from '../../middleware/validate.js';

/** Deliberately unauthenticated — payment providers can't hold our session JWTs. The provider's
 * HMAC signature (verified inside payment.engine.ts against the raw request bytes) is the only
 * trust boundary here. Mounted as its own router (not under paymentsRouter) so it never picks up
 * that router's `authenticate` gate. */
export const paymentWebhooksRouter = Router();

paymentWebhooksRouter.post('/:provider', validate({ params: webhookProviderParamSchema }), webhookController.handle);
