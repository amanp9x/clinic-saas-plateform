import crypto from 'node:crypto';
import { env } from '../../../config/env.js';
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

/**
 * Deterministic, fully-functional dev/test provider — no external network calls, no real money
 * movement. Used whenever no real provider credentials are configured (see
 * payment-provider.factory.ts), and always in the test suite regardless of env, so automated
 * tests never depend on real Razorpay/Stripe credentials.
 *
 * Amount/currency are encoded directly into the order/payment id strings rather than kept in an
 * in-memory store, so `fetchPayment` stays a pure function of its input — no shared mutable state
 * to leak between concurrent requests or test files.
 */
function sign(payload: string): string {
  return crypto.createHmac('sha256', env.MOCK_PAYMENT_SECRET).update(payload).digest('hex');
}

function encodeId(prefix: string, amount: number, currency: string): string {
  const amountPaise = Math.round(amount * 100);
  const rand = crypto.randomBytes(6).toString('hex');
  return `${prefix}_${amountPaise}_${currency}_${rand}`;
}

function decodeId(id: string): { amount: number; currency: string } | null {
  const parts = id.split('_');
  if (parts.length < 4) return null;
  const amountPaise = Number(parts[2]);
  const currency = parts[3];
  if (!Number.isFinite(amountPaise) || !currency) return null;
  return { amount: amountPaise / 100, currency };
}

/** Test-only escape hatch — lets integration tests construct deliberately-tampered-but-validly-signed
 * payloads (e.g. a payment id encoding the wrong amount) to exercise the server-side reconciliation
 * checks in payment.engine.ts. Never used by application code, only test fixtures. */
export function signMockPayload(payload: string): string {
  return sign(payload);
}

/** Mock-only helper (not part of the shared PaymentProviderClient interface) — stands in for
 * what a real checkout SDK's success/failure callback hands back to the frontend. Server-side
 * only, so the mock signing secret never reaches the browser. */
export function simulateMockCheckout(
  providerOrderId: string,
  outcome: 'success' | 'failure',
): { providerPaymentId: string; providerSignature: string | null } {
  const decoded = decodeId(providerOrderId);
  const amount = decoded?.amount ?? 0;
  const currency = decoded?.currency ?? 'INR';
  const providerPaymentId = encodeId('mock_pay', amount, currency);
  if (outcome === 'failure') {
    return { providerPaymentId, providerSignature: null };
  }
  return { providerPaymentId, providerSignature: sign(`${providerOrderId}|${providerPaymentId}`) };
}

export function buildMockWebhookPayload(input: {
  eventId: string;
  eventType: 'payment.captured' | 'payment.failed' | 'refund.processed';
  providerOrderId: string;
  providerPaymentId: string;
  amount: number;
  currency: string;
}): { body: Buffer; signature: string } {
  const json = JSON.stringify({
    id: input.eventId,
    event: input.eventType,
    orderId: input.providerOrderId,
    paymentId: input.providerPaymentId,
    amount: Math.round(input.amount * 100),
    currency: input.currency,
    method: 'UPI',
  });
  const body = Buffer.from(json, 'utf8');
  return { body, signature: sign(body.toString('utf8')) };
}

export const mockProvider: PaymentProviderClient = {
  name: 'MOCK',

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    return { providerOrderId: encodeId('mock_order', input.amount, input.currency), providerPublicKey: 'mock_public_key' };
  },

  verifyPaymentSignature(input: VerifySignatureInput): boolean {
    const expected = sign(`${input.providerOrderId}|${input.providerPaymentId}`);
    return timingSafeEqualHex(expected, input.providerSignature);
  },

  async fetchPayment(providerPaymentId: string): Promise<ProviderPaymentDetails> {
    const decoded = decodeId(providerPaymentId);
    if (!decoded) {
      return { providerPaymentId, providerOrderId: '', status: 'failed', amount: 0, currency: 'INR', method: null, failureMessage: 'Unknown mock payment id' };
    }
    return { providerPaymentId, providerOrderId: '', status: 'captured', amount: decoded.amount, currency: decoded.currency, method: 'UPI' };
  },

  async createRefund(_input: CreateRefundInput): Promise<CreateRefundResult> {
    return { providerRefundId: `mock_refund_${crypto.randomBytes(6).toString('hex')}`, status: 'processed' };
  },

  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    if (!signatureHeader) return false;
    return timingSafeEqualHex(sign(rawBody.toString('utf8')), signatureHeader);
  },

  parseWebhookEvent(rawBody: Buffer): ParsedWebhookEvent {
    const data = JSON.parse(rawBody.toString('utf8')) as {
      id: string;
      event: string;
      orderId: string;
      paymentId: string;
      amount: number;
      currency: string;
      method?: string;
    };
    const statusMap: Record<string, ParsedWebhookEvent['status']> = {
      'payment.captured': 'captured',
      'payment.failed': 'failed',
      'refund.processed': 'refunded',
    };
    return {
      providerEventId: data.id,
      eventType: data.event,
      providerOrderId: data.orderId ?? null,
      providerPaymentId: data.paymentId ?? null,
      status: statusMap[data.event] ?? 'unknown',
      method: (data.method as ParsedWebhookEvent['method']) ?? null,
      amount: typeof data.amount === 'number' ? data.amount / 100 : null,
    };
  },
};

function timingSafeEqualHex(a: string, b: string | null | undefined): boolean {
  if (!b) return false;
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
