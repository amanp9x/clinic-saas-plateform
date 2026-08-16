import type { PaymentMethod } from '@prisma/client';

export interface CreateOrderInput {
  amount: number; // in the currency's major unit (rupees), not paise/cents
  currency: string;
  receipt: string; // human-safe reference, e.g. the booking reference
  notes?: Record<string, string>;
}

export interface CreateOrderResult {
  providerOrderId: string;
  /** Public key/identifier the frontend checkout SDK needs — never a secret. */
  providerPublicKey: string | null;
}

export interface VerifySignatureInput {
  providerOrderId: string;
  providerPaymentId: string;
  providerSignature: string;
}

export interface ProviderPaymentDetails {
  providerPaymentId: string;
  providerOrderId: string;
  status: 'captured' | 'authorized' | 'failed' | 'created' | 'pending';
  amount: number;
  currency: string;
  method: PaymentMethod | null;
  failureCode?: string;
  failureMessage?: string;
}

export interface CreateRefundInput {
  providerPaymentId: string;
  amount: number;
  reason: string;
}

export interface CreateRefundResult {
  providerRefundId: string;
  status: 'processed' | 'pending' | 'failed';
}

export interface ParsedWebhookEvent {
  providerEventId: string;
  eventType: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  status: 'captured' | 'authorized' | 'failed' | 'refunded' | 'unknown';
  method: PaymentMethod | null;
  amount: number | null;
  failureCode?: string;
  failureMessage?: string;
}

/**
 * Provider-agnostic payment gateway abstraction. No business logic (pricing, appointment
 * confirmation, invoicing) lives here or in any implementation of this interface — those stay
 * centralized in payment.engine.ts, which is the only caller of these methods.
 */
export interface PaymentProviderClient {
  readonly name: 'MOCK' | 'RAZORPAY' | 'STRIPE';

  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;

  /** Verifies the checkout-completion signature the client hands back after payment. Must never
   * be trusted as the *only* proof of payment — callers should also reconcile via `fetchPayment`
   * or a webhook. */
  verifyPaymentSignature(input: VerifySignatureInput): boolean;

  fetchPayment(providerPaymentId: string): Promise<ProviderPaymentDetails>;

  createRefund(input: CreateRefundInput): Promise<CreateRefundResult>;

  /** Verifies a webhook's signature against the exact raw request bytes. */
  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean;

  parseWebhookEvent(rawBody: Buffer): ParsedWebhookEvent;
}
