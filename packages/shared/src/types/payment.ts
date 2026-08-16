import type {
  PaymentAttemptStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentTransactionStatus,
  RefundStatus,
} from '../enums.js';

/** Server-computed price snapshot — never accept these numbers from the client. */
export interface PriceBreakdownDto {
  subtotal: number;
  discount: number;
  tax: number;
  amount: number;
  currency: string;
}

export interface PaymentAttemptDto {
  id: string;
  attemptNumber: number;
  provider: PaymentProvider;
  status: PaymentAttemptStatus;
  method: PaymentMethod | null;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: string;
}

export interface RefundDto {
  id: string;
  amount: number;
  reason: string;
  status: RefundStatus;
  createdAt: string;
}

/** Everything a patient/reception/clinic is allowed to see about a payment — provider secrets,
 * webhook payloads, and raw provider responses are never included in this shape. */
export interface PaymentDto {
  id: string;
  appointmentId: string;
  bookingReference: string;
  doctorId: string;
  doctorName: string;
  clinicId: string;
  clinicName: string;
  provider: PaymentProvider;
  status: PaymentTransactionStatus;
  subtotal: number;
  discount: number;
  tax: number;
  amount: number;
  refundedAmount: number;
  currency: string;
  method: PaymentMethod | null;
  /** The active/latest attempt's provider order id — needed by the client to resume paying a
   * CREATED/PENDING order without re-deriving it. Not a secret. */
  providerOrderId: string | null;
  expiresAt: string;
  capturedAt: string | null;
  createdAt: string;
  attempts: PaymentAttemptDto[];
  refunds: RefundDto[];
  invoiceNumber: string | null;
}

/** Order-creation response — the minimum a checkout UI needs to start a provider payment. Never
 * includes the provider secret key, only the public/publishable identifier where applicable. */
export interface PaymentOrderDto {
  paymentId: string;
  provider: PaymentProvider;
  providerOrderId: string;
  amount: number;
  currency: string;
  expiresAt: string;
  /** Public key the frontend SDK needs to open checkout (e.g. Razorpay key_id). Never a secret. */
  providerPublicKey: string | null;
}

export interface PaymentSummaryDto {
  id: string;
  appointmentId: string;
  bookingReference: string;
  doctorName: string;
  clinicName: string;
  status: PaymentTransactionStatus;
  amount: number;
  currency: string;
  method: PaymentMethod | null;
  createdAt: string;
  invoiceNumber: string | null;
}

export interface InvoiceDto {
  id: string;
  invoiceNumber: string;
  appointmentId: string;
  bookingReference: string;
  patientName: string;
  doctorName: string;
  clinicName: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  status: PaymentTransactionStatus;
  method: PaymentMethod | null;
  issuedAt: string;
}

export interface ClinicBillingSummaryDto {
  totalCollected: number;
  pendingAmount: number;
  refundedAmount: number;
  successfulCount: number;
  failedCount: number;
  refundedCount: number;
  currency: string;
}

export interface ClinicBillingRowDto {
  paymentId: string;
  appointmentId: string;
  bookingReference: string;
  patientName: string;
  doctorName: string;
  status: PaymentTransactionStatus;
  amount: number;
  currency: string;
  method: PaymentMethod | null;
  createdAt: string;
}
