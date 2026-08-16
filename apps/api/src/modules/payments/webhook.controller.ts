import type { Request, Response } from 'express';
import { paymentEngine } from './payment.engine.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { ValidationError } from '../../utils/app-error.js';

const PROVIDER_MAP: Record<string, 'MOCK' | 'RAZORPAY' | 'STRIPE'> = {
  mock: 'MOCK',
  razorpay: 'RAZORPAY',
  stripe: 'STRIPE',
};

const SIGNATURE_HEADER: Record<string, string> = {
  mock: 'x-mock-signature',
  razorpay: 'x-razorpay-signature',
  stripe: 'stripe-signature',
};

export const webhookController = {
  handle: asyncHandler(async (req: Request, res: Response) => {
    const providerParam = req.params.provider!;
    const provider = PROVIDER_MAP[providerParam];
    if (!provider) throw new ValidationError('Unknown payment provider');
    if (!req.rawBody) throw new ValidationError('Missing request body');

    const signature = req.headers[SIGNATURE_HEADER[providerParam]!] as string | undefined;
    await paymentEngine.handleWebhookEvent(provider, req.rawBody, signature);

    // Always 200 on successfully-processed (including idempotent-duplicate) events so the
    // provider doesn't retry-storm us; genuine signature/parse failures throw and surface as 4xx.
    sendSuccess(res, { received: true });
  }),
};
