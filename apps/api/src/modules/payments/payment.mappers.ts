import type {
  InvoiceDto,
  PaymentAttemptDto,
  PaymentDto,
  PaymentOrderDto,
  PaymentSummaryDto,
  RefundDto,
  RefundRequestSummaryDto,
} from '@clinic/shared';
import type { PaymentWithRelations } from './payment.repository.js';

export function toPaymentDto(payment: PaymentWithRelations): PaymentDto {
  return {
    id: payment.id,
    appointmentId: payment.appointmentId,
    bookingReference: payment.appointment.bookingReference,
    doctorId: payment.doctorId,
    doctorName: payment.appointment.doctor.displayName,
    clinicId: payment.clinicId,
    clinicName: payment.appointment.clinic.name,
    provider: payment.provider,
    status: payment.status,
    subtotal: Number(payment.subtotal),
    discount: Number(payment.discount),
    tax: Number(payment.tax),
    amount: Number(payment.amount),
    refundedAmount: Number(payment.refundedAmount),
    currency: payment.currency,
    method: payment.method,
    providerOrderId: payment.providerOrderId,
    expiresAt: payment.expiresAt.toISOString(),
    capturedAt: payment.capturedAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
    attempts: payment.attempts.map(toAttemptDto),
    refunds: payment.refunds.map(toRefundDto),
    refundRequests: payment.refundRequests.map(toRefundRequestSummaryDto),
    invoiceNumber: payment.invoice?.invoiceNumber ?? null,
  };
}

function toAttemptDto(attempt: PaymentWithRelations['attempts'][number]): PaymentAttemptDto {
  return {
    id: attempt.id,
    attemptNumber: attempt.attemptNumber,
    provider: attempt.provider,
    status: attempt.status,
    method: attempt.method,
    failureCode: attempt.failureCode,
    failureMessage: attempt.failureMessage,
    createdAt: attempt.createdAt.toISOString(),
  };
}

function toRefundDto(refund: PaymentWithRelations['refunds'][number]): RefundDto {
  return {
    id: refund.id,
    amount: Number(refund.amount),
    reason: refund.reason,
    status: refund.status,
    createdAt: refund.createdAt.toISOString(),
  };
}

function toRefundRequestSummaryDto(request: PaymentWithRelations['refundRequests'][number]): RefundRequestSummaryDto {
  return {
    id: request.id,
    amount: request.amount ? request.amount.toString() : null,
    reason: request.reason,
    status: request.status,
    reviewNotes: request.reviewNotes,
    respondedAt: request.respondedAt ? request.respondedAt.toISOString() : null,
    createdAt: request.createdAt.toISOString(),
  };
}

export function toPaymentOrderDto(payment: PaymentWithRelations, providerOrderId: string, providerPublicKey: string | null): PaymentOrderDto {
  return {
    paymentId: payment.id,
    provider: payment.provider,
    providerOrderId,
    amount: Number(payment.amount),
    currency: payment.currency,
    expiresAt: payment.expiresAt.toISOString(),
    providerPublicKey,
  };
}

export function toPaymentSummaryDto(payment: PaymentWithRelations): PaymentSummaryDto {
  return {
    id: payment.id,
    appointmentId: payment.appointmentId,
    bookingReference: payment.appointment.bookingReference,
    doctorName: payment.appointment.doctor.displayName,
    clinicName: payment.appointment.clinic.name,
    status: payment.status,
    amount: Number(payment.amount),
    currency: payment.currency,
    method: payment.method,
    createdAt: payment.createdAt.toISOString(),
    invoiceNumber: payment.invoice?.invoiceNumber ?? null,
  };
}

export function toInvoiceDto(payment: PaymentWithRelations): InvoiceDto | null {
  if (!payment.invoice) return null;
  const invoice = payment.invoice;
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    appointmentId: payment.appointmentId,
    bookingReference: payment.appointment.bookingReference,
    patientName: payment.appointment.patient.fullName,
    doctorName: payment.appointment.doctor.displayName,
    clinicName: payment.appointment.clinic.name,
    subtotal: Number(invoice.subtotal),
    discount: Number(invoice.discount),
    tax: Number(invoice.tax),
    total: Number(invoice.total),
    currency: invoice.currency,
    status: invoice.status,
    method: invoice.method,
    issuedAt: invoice.issuedAt.toISOString(),
  };
}
