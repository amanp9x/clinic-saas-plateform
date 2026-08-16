import crypto from 'node:crypto';
import { env } from '../../../config/env.js';
import { AppError } from '../../../utils/app-error.js';
import { ErrorCode } from '@clinic/shared';
import type {
  CreateOrderInput,
  CreateOrderResult,
  CreateRefundInput,
  CreateRefundResult,
  ParsedWebhookEvent,
  PaymentProviderClient,
  ProviderPaymentDetails,
  VerifySignatureInput,
} from '../payment-provider.interface.js';

const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';

/**
 * Real Razorpay integration via plain REST calls (no `razorpay` SDK dependency needed — its API
 * is a small, well-documented HTTPS surface, and Node 20's built-in `fetch` covers it). Only ever
 * selected by payment-provider.factory.ts when RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET are both
 * configured; with no credentials in this environment it compiles but is never exercised — the
 * mock provider is what dev/test actually uses.
 */
function requireCredentials(): { keyId: string; keySecret: string } {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new AppError(500, ErrorCode.INTERNAL_ERROR, 'Razorpay is not configured on this server');
  }
  return { keyId: env.RAZORPAY_KEY_ID, keySecret: env.RAZORPAY_KEY_SECRET };
}

function authHeader(): string {
  const { keyId, keySecret } = requireCredentials();
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
}

async function razorpayFetch<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${RAZORPAY_API_BASE}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: authHeader(), 'Content-Type': 'application/json' },
  });
  const body = (await res.json()) as T & { error?: { description?: string } };
  if (!res.ok) {
    // Never forward the raw provider error body to end users — log server-side only, surface a
    // generic message. (Logging itself happens via the caller's error handler, not here.)
    throw new AppError(502, ErrorCode.INTERNAL_ERROR, 'Payment provider request failed');
  }
  return body;
}

const RAZORPAY_METHOD_MAP: Record<string, ProviderPaymentDetails['method']> = {
  upi: 'UPI',
  card: 'CARD',
  netbanking: 'NETBANKING',
  wallet: 'WALLET',
};

export const razorpayProvider: PaymentProviderClient = {
  name: 'RAZORPAY',

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const { keyId } = requireCredentials();
    const order = await razorpayFetch<{ id: string }>('/orders', {
      method: 'POST',
      body: JSON.stringify({
        amount: Math.round(input.amount * 100),
        currency: input.currency,
        receipt: input.receipt,
        notes: input.notes ?? {},
      }),
    });
    return { providerOrderId: order.id, providerPublicKey: keyId };
  },

  verifyPaymentSignature(input: VerifySignatureInput): boolean {
    const { keySecret } = requireCredentials();
    const expected = crypto
      .createHmac('sha256', keySecret)
      .update(`${input.providerOrderId}|${input.providerPaymentId}`)
      .digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(input.providerSignature, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  },

  async fetchPayment(providerPaymentId: string): Promise<ProviderPaymentDetails> {
    const payment = await razorpayFetch<{
      id: string;
      order_id: string;
      status: string;
      amount: number;
      currency: string;
      method?: string;
      error_code?: string;
      error_description?: string;
    }>(`/payments/${providerPaymentId}`, { method: 'GET' });
    const statusMap: Record<string, ProviderPaymentDetails['status']> = {
      captured: 'captured',
      authorized: 'authorized',
      failed: 'failed',
      created: 'created',
    };
    return {
      providerPaymentId: payment.id,
      providerOrderId: payment.order_id,
      status: statusMap[payment.status] ?? 'pending',
      amount: payment.amount / 100,
      currency: payment.currency,
      method: payment.method ? (RAZORPAY_METHOD_MAP[payment.method] ?? 'OTHER') : null,
      failureCode: payment.error_code,
      failureMessage: payment.error_description,
    };
  },

  async createRefund(input: CreateRefundInput): Promise<CreateRefundResult> {
    const refund = await razorpayFetch<{ id: string; status: string }>(`/payments/${input.providerPaymentId}/refund`, {
      method: 'POST',
      body: JSON.stringify({ amount: Math.round(input.amount * 100), notes: { reason: input.reason } }),
    });
    return { providerRefundId: refund.id, status: refund.status === 'processed' ? 'processed' : 'pending' };
  },

  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    if (!signatureHeader || !env.RAZORPAY_WEBHOOK_SECRET) return false;
    const expected = crypto.createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signatureHeader, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  },

  parseWebhookEvent(rawBody: Buffer): ParsedWebhookEvent {
    const data = JSON.parse(rawBody.toString('utf8')) as {
      id: string;
      event: string;
      payload: {
        payment?: { entity: { id: string; order_id: string; amount: number; method?: string; error_code?: string; error_description?: string } };
        refund?: { entity: { id: string; payment_id: string } };
      };
    };
    const statusMap: Record<string, ParsedWebhookEvent['status']> = {
      'payment.captured': 'captured',
      'payment.failed': 'failed',
      'payment.authorized': 'authorized',
      'refund.processed': 'refunded',
    };
    const paymentEntity = data.payload.payment?.entity;
    return {
      providerEventId: data.id,
      eventType: data.event,
      providerOrderId: paymentEntity?.order_id ?? null,
      providerPaymentId: paymentEntity?.id ?? data.payload.refund?.entity.payment_id ?? null,
      status: statusMap[data.event] ?? 'unknown',
      method: paymentEntity?.method ? (RAZORPAY_METHOD_MAP[paymentEntity.method] ?? 'OTHER') : null,
      amount: paymentEntity ? paymentEntity.amount / 100 : null,
      failureCode: paymentEntity?.error_code,
      failureMessage: paymentEntity?.error_description,
    };
  },
};
