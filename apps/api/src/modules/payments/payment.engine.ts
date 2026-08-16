import type { PaymentTransactionStatus, UserRole } from '@prisma/client';
import { CLINIC_PERMISSIONS } from '@clinic/shared';
import type { ClinicBillingQuery, ClinicBillingRowDto, ClinicBillingSummaryDto, PaginatedResult, PaymentDto, PaymentListQuery, PaymentOrderDto, PaymentSummaryDto, RefundPaymentInput, VerifyPaymentInput } from '@clinic/shared';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../utils/app-error.js';
import { ErrorCode } from '@clinic/shared';
import { recordAuditLog } from '../../utils/audit-log.js';
import { emitToClinicRoom, emitToUserRoom } from '../../sockets/emit.js';
import { notifyUser, NotificationType } from '../notifications/notifications.service.js';
import { patientRepository } from '../patient/patient.repository.js';
import { assertClinicPermission } from '../reception/reception.shared.js';
import { resolveDoctorOrThrow } from '../doctor/doctor.shared.js';
import { bookingEngine } from '../booking/booking.engine.js';
import { bookingRepository } from '../booking/booking.repository.js';
import { SOCKET_EVENTS } from '@clinic/shared';
import { paymentRepository, type PaymentWithRelations } from './payment.repository.js';
import { toPaymentDto, toPaymentOrderDto, toPaymentSummaryDto } from './payment.mappers.js';
import { activePaymentProvider, getProviderByName } from './payment-provider.factory.js';
import type { ParsedWebhookEvent, ProviderPaymentDetails } from './payment-provider.interface.js';
import { assertTransition } from './payment-state-machine.js';
import { calculatePrice } from './pricing.service.js';
import { calculateRefundEligibility } from './refund-eligibility.service.js';
import { nextInvoiceNumber } from './invoice-number.util.js';
import { generateInvoicePdf } from './invoice-pdf.service.js';
import { simulateMockCheckout } from './providers/mock-provider.js';
import { isUniqueConstraintError } from '../doctor-queue/queue.repository.js';

const ACTIVE_PAYMENT_STATUSES = new Set<PaymentTransactionStatus>(['CREATED', 'PENDING', 'AUTHORIZED']);

function orderExpiry(): Date {
  return new Date(Date.now() + env.PAYMENT_ORDER_EXPIRY_MINUTES * 60_000);
}

async function refetch(paymentId: string): Promise<PaymentWithRelations> {
  const payment = await paymentRepository.findById(paymentId);
  if (!payment) throw new NotFoundError('Payment');
  return payment;
}

/** Lazy expiry — no cron/job infra in this codebase (same documented convention as SlotHold in
 * Phase 8), so a stale CREATED/PENDING payment is only reaped when next read/touched. Freeing the
 * slot means cancelling the PENDING appointment underneath it, via the existing cancellation core. */
async function expireIfStale(payment: PaymentWithRelations): Promise<PaymentWithRelations> {
  if (!ACTIVE_PAYMENT_STATUSES.has(payment.status) || payment.expiresAt.getTime() > Date.now()) {
    return payment;
  }
  const claimed = await prisma.payment.updateMany({
    where: { id: payment.id, status: payment.status },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  });
  if (claimed.count === 1) {
    const appointment = await bookingRepository.findAppointmentByIdForActor(payment.appointmentId);
    if (appointment && appointment.status === 'PENDING') {
      await bookingEngine.cancelCore(appointment, {
        reason: 'Payment window expired — appointment automatically released',
        actorUserId: appointment.patient.user.id,
        source: 'PATIENT',
      });
    }
    recordAuditLog({
      actorUserId: payment.appointment.patient.userId,
      action: 'payment.expired',
      entityType: 'Payment',
      entityId: payment.id,
      clinicId: payment.clinicId,
      metadata: { appointmentId: payment.appointmentId },
    });
    await notifyUser({
      userId: payment.appointment.patient.userId,
      type: NotificationType.APPOINTMENT_UPDATE,
      title: 'Payment window expired',
      message: `Your payment window for ${payment.appointment.bookingReference} has expired and the slot has been released.`,
      relatedEntityType: 'Appointment',
      relatedEntityId: payment.appointmentId,
    });
    emitToUserRoom(payment.appointment.patient.userId, SOCKET_EVENTS.PAYMENT.FAILED, { paymentId: payment.id, status: 'CANCELLED' });
  }
  return refetch(payment.id);
}

async function getOwnedPaymentForPatient(userId: string, paymentId: string): Promise<PaymentWithRelations> {
  const payment = await paymentRepository.findById(paymentId);
  // 404, not 403, for a foreign payment — never confirms existence to a non-owner (IDOR-safe,
  // same convention the booking module uses for reschedule/cancel ownership checks).
  if (!payment || payment.appointment.patient.userId !== userId) {
    throw new NotFoundError('Payment');
  }
  return payment;
}

async function assertClinicCanViewPayment(userId: string, role: UserRole, payment: PaymentWithRelations): Promise<void> {
  if (role === 'DOCTOR') {
    const doctor = await resolveDoctorOrThrow(userId);
    if (doctor.id !== payment.doctorId) throw new NotFoundError('Payment');
    return;
  }
  await assertClinicPermission(userId, role, payment.clinicId, CLINIC_PERMISSIONS.PAYMENT_VIEW);
}

/** Shared by both the direct verify endpoint and the webhook handler — the single place a
 * Payment ever transitions into CAPTURED, so both paths get identical, idempotent, concurrency-safe
 * behavior. The guarded `updateMany` (not `update`) is what makes two simultaneous callers (two
 * verify requests, or a verify racing a webhook) converge on exactly one invoice/one confirmation. */
async function applyCapture(
  payment: PaymentWithRelations,
  attemptId: string | undefined,
  details: ProviderPaymentDetails,
): Promise<PaymentWithRelations> {
  if (payment.status === 'CAPTURED' || payment.status === 'PARTIALLY_REFUNDED' || payment.status === 'REFUNDED') {
    return payment; // idempotent — duplicate verification/webhook delivery
  }
  assertTransition(payment.status, 'CAPTURED');

  const claimed = await prisma.payment.updateMany({
    where: { id: payment.id, status: payment.status },
    data: {
      status: 'CAPTURED',
      method: details.method,
      providerPaymentId: details.providerPaymentId,
      capturedAmount: details.amount,
      capturedAt: new Date(),
    },
  });
  if (attemptId) {
    await paymentRepository.updateAttempt(attemptId, { status: 'CAPTURED', providerPaymentId: details.providerPaymentId, method: details.method });
  }
  if (claimed.count !== 1) {
    // Lost the race to a concurrent capture — the winner already did everything below.
    return refetch(payment.id);
  }

  await bookingEngine.confirmAfterPayment(payment.appointmentId);

  const invoiceNumber = await nextInvoiceNumber();
  try {
    await paymentRepository.createInvoice({
      invoiceNumber,
      paymentId: payment.id,
      appointmentId: payment.appointmentId,
      patientId: payment.patientId,
      doctorId: payment.doctorId,
      clinicId: payment.clinicId,
      subtotal: Number(payment.subtotal),
      discount: Number(payment.discount),
      tax: Number(payment.tax),
      total: Number(payment.amount),
      currency: payment.currency,
      status: 'CAPTURED',
      method: details.method,
    });
  } catch (err) {
    // Defense-in-depth: Invoice.paymentId is @unique, so even a theoretical duplicate invoice
    // attempt (the guarded updateMany above should already make this unreachable) is a no-op.
    if (!isUniqueConstraintError(err)) throw err;
  }

  recordAuditLog({
    actorUserId: payment.appointment.patient.userId,
    action: 'payment.captured',
    entityType: 'Payment',
    entityId: payment.id,
    clinicId: payment.clinicId,
    metadata: { amount: details.amount, method: details.method, appointmentId: payment.appointmentId },
  });
  await notifyUser({
    userId: payment.appointment.patient.userId,
    type: NotificationType.APPOINTMENT_UPDATE,
    title: 'Payment successful',
    message: `Payment received for ${payment.appointment.bookingReference}. Your appointment with ${payment.appointment.doctor.displayName} is confirmed.`,
    relatedEntityType: 'Appointment',
    relatedEntityId: payment.appointmentId,
  });
  emitToClinicRoom(payment.clinicId, SOCKET_EVENTS.PAYMENT.CAPTURED, { paymentId: payment.id, appointmentId: payment.appointmentId, clinicId: payment.clinicId });
  emitToUserRoom(payment.appointment.patient.userId, SOCKET_EVENTS.PAYMENT.CAPTURED, { paymentId: payment.id });

  return refetch(payment.id);
}

async function applyFailure(payment: PaymentWithRelations, attemptId: string | undefined, failureCode?: string, failureMessage?: string): Promise<PaymentWithRelations> {
  if (!ACTIVE_PAYMENT_STATUSES.has(payment.status)) {
    return payment; // idempotent — already resolved one way or another
  }
  const claimed = await prisma.payment.updateMany({ where: { id: payment.id, status: payment.status }, data: { status: 'FAILED' } });
  if (attemptId) {
    await paymentRepository.updateAttempt(attemptId, { status: 'FAILED', failureCode: failureCode ?? null, failureMessage: failureMessage ?? 'Payment was not completed' });
  }
  if (claimed.count === 1) {
    recordAuditLog({
      actorUserId: payment.appointment.patient.userId,
      action: 'payment.failed',
      entityType: 'Payment',
      entityId: payment.id,
      clinicId: payment.clinicId,
      metadata: { failureCode: failureCode ?? null },
    });
    await notifyUser({
      userId: payment.appointment.patient.userId,
      type: NotificationType.APPOINTMENT_UPDATE,
      title: 'Payment failed',
      message: `Payment for ${payment.appointment.bookingReference} could not be completed. You can retry from your appointment.`,
      relatedEntityType: 'Appointment',
      relatedEntityId: payment.appointmentId,
    });
    emitToUserRoom(payment.appointment.patient.userId, SOCKET_EVENTS.PAYMENT.FAILED, { paymentId: payment.id });
  }
  return refetch(payment.id);
}

export const paymentEngine = {
  async createOrder(userId: string, appointmentId: string): Promise<PaymentOrderDto> {
    const patient = await patientRepository.findByUserId(userId);
    if (!patient) throw new NotFoundError('Patient profile');
    const appointment = await bookingRepository.findAppointmentByIdForActor(appointmentId);
    if (!appointment || appointment.patientId !== patient.id) throw new NotFoundError('Appointment');
    if (appointment.status !== 'PENDING') {
      throw new ConflictError('This appointment does not require payment');
    }

    let payment = await paymentRepository.findByAppointmentId(appointmentId);
    if (payment) {
      payment = await expireIfStale(payment);
      if (payment.status === 'CAPTURED' || payment.status === 'PARTIALLY_REFUNDED' || payment.status === 'REFUNDED') {
        throw new ConflictError('This appointment has already been paid for');
      }
      if (payment.status === 'CREATED' || payment.status === 'PENDING') {
        const latest = payment.attempts[0];
        if (latest?.providerOrderId) {
          return toPaymentOrderDto(payment, latest.providerOrderId, activePaymentProvider.name === 'RAZORPAY' ? env.RAZORPAY_KEY_ID ?? null : 'mock_public_key');
        }
      }
      if (payment.status === 'FAILED') {
        return this.retryOrder(userId, payment.id);
      }
    }

    const price = await calculatePrice(appointment.doctorId, appointment.clinicId);
    const created = await paymentRepository.createPayment({
      appointmentId,
      patientId: patient.id,
      doctorId: appointment.doctorId,
      clinicId: appointment.clinicId,
      provider: activePaymentProvider.name,
      subtotal: price.subtotal,
      discount: price.discount,
      tax: price.tax,
      amount: price.amount,
      currency: price.currency,
      expiresAt: orderExpiry(),
    });

    const order = await activePaymentProvider.createOrder({ amount: price.amount, currency: price.currency, receipt: appointment.bookingReference });
    await paymentRepository.createAttempt({
      paymentId: created.id,
      attemptNumber: 1,
      provider: activePaymentProvider.name,
      providerOrderId: order.providerOrderId,
      amount: price.amount,
      currency: price.currency,
    });
    assertTransition('CREATED', 'PENDING');
    const updated = await paymentRepository.updateStatus(created.id, { status: 'PENDING', providerOrderId: order.providerOrderId });

    recordAuditLog({
      actorUserId: userId,
      action: 'payment.created',
      entityType: 'Payment',
      entityId: created.id,
      clinicId: appointment.clinicId,
      metadata: { appointmentId, amount: price.amount, currency: price.currency, provider: activePaymentProvider.name },
    });
    await notifyUser({
      userId,
      type: NotificationType.APPOINTMENT_UPDATE,
      title: 'Payment initiated',
      message: `Complete your payment of ${price.currency} ${price.amount} for appointment ${appointment.bookingReference}.`,
      relatedEntityType: 'Appointment',
      relatedEntityId: appointmentId,
    });
    emitToClinicRoom(appointment.clinicId, SOCKET_EVENTS.PAYMENT.CREATED, { paymentId: created.id, appointmentId, clinicId: appointment.clinicId });

    return toPaymentOrderDto(updated, order.providerOrderId, order.providerPublicKey);
  },

  async retryOrder(userId: string, paymentId: string): Promise<PaymentOrderDto> {
    const payment = await getOwnedPaymentForPatient(userId, paymentId);
    if (payment.status !== 'FAILED') {
      throw new ConflictError('Only a failed payment can be retried');
    }
    assertTransition('FAILED', 'PENDING');

    const attemptNumber = (await paymentRepository.countAttempts(paymentId)) + 1;
    const order = await activePaymentProvider.createOrder({ amount: Number(payment.amount), currency: payment.currency, receipt: payment.appointment.bookingReference });
    await paymentRepository.createAttempt({
      paymentId,
      attemptNumber,
      provider: activePaymentProvider.name,
      providerOrderId: order.providerOrderId,
      amount: Number(payment.amount),
      currency: payment.currency,
    });
    const updated = await paymentRepository.updateStatus(paymentId, { status: 'PENDING', providerOrderId: order.providerOrderId, expiresAt: orderExpiry() });

    recordAuditLog({
      actorUserId: userId,
      action: 'payment.retry',
      entityType: 'Payment',
      entityId: paymentId,
      clinicId: payment.clinicId,
      metadata: { attemptNumber },
    });

    return toPaymentOrderDto(updated, order.providerOrderId, order.providerPublicKey);
  },

  /** Mock-provider-only convenience — stands in for a real checkout SDK's success/failure
   * callback so the mock flow can be exercised end to end without a real gateway. Throws if a
   * real provider is active. */
  async simulateCheckout(userId: string, paymentId: string, outcome: 'success' | 'failure'): Promise<{ providerPaymentId: string; providerSignature: string | null; providerOrderId: string }> {
    const payment = await getOwnedPaymentForPatient(userId, paymentId);
    if (activePaymentProvider.name !== 'MOCK') {
      throw new ConflictError('Checkout simulation is only available for the mock payment provider');
    }
    if (!payment.providerOrderId) throw new ConflictError('No active order for this payment');
    const result = simulateMockCheckout(payment.providerOrderId, outcome);
    return { ...result, providerOrderId: payment.providerOrderId };
  },

  async verifyPayment(userId: string, input: VerifyPaymentInput): Promise<PaymentDto> {
    let payment = await getOwnedPaymentForPatient(userId, input.paymentId);
    payment = await expireIfStale(payment);

    if (payment.status === 'CAPTURED' || payment.status === 'PARTIALLY_REFUNDED' || payment.status === 'REFUNDED') {
      return toPaymentDto(payment); // idempotent — duplicate verification
    }
    if (payment.status !== 'PENDING' && payment.status !== 'CREATED') {
      throw new ConflictError(`Cannot verify a payment in status ${payment.status}`);
    }

    const attempt = payment.attempts.find((a) => a.providerOrderId === input.providerOrderId);
    if (!attempt) {
      throw new ValidationError('This order does not belong to this payment');
    }

    const validSignature = activePaymentProvider.verifyPaymentSignature({
      providerOrderId: input.providerOrderId,
      providerPaymentId: input.providerPaymentId,
      providerSignature: input.providerSignature,
    });
    if (!validSignature) {
      await applyFailure(payment, attempt.id, 'signature_mismatch', 'Payment verification failed');
      throw new ValidationError('Payment signature verification failed');
    }

    // Independent reconciliation with the provider — never trust the frontend's claimed status
    // or amount, only the signature we just verified plus what the provider itself reports.
    const details = await activePaymentProvider.fetchPayment(input.providerPaymentId);
    if (details.status !== 'captured') {
      await applyFailure(payment, attempt.id, details.failureCode, details.failureMessage ?? 'Payment was not captured');
      throw new ValidationError('Payment was not captured by the provider');
    }
    if (Math.abs(details.amount - Number(payment.amount)) > 0.01 || details.currency !== payment.currency) {
      await applyFailure(payment, attempt.id, 'amount_mismatch', 'Payment amount did not match the expected amount');
      recordAuditLog({
        actorUserId: userId,
        action: 'payment.amount_mismatch',
        entityType: 'Payment',
        entityId: payment.id,
        clinicId: payment.clinicId,
        metadata: { expected: Number(payment.amount), received: details.amount },
      });
      throw new ValidationError('Payment amount mismatch');
    }

    const captured = await applyCapture(payment, attempt.id, details);
    return toPaymentDto(captured);
  },

  async handleWebhookEvent(providerName: 'MOCK' | 'RAZORPAY' | 'STRIPE', rawBody: Buffer, signatureHeader: string | undefined): Promise<void> {
    const provider = getProviderByName(providerName);
    if (!provider.verifyWebhookSignature(rawBody, signatureHeader)) {
      throw new ValidationError('Invalid webhook signature');
    }

    let parsed: ParsedWebhookEvent;
    try {
      parsed = provider.parseWebhookEvent(rawBody);
    } catch {
      throw new ValidationError('Malformed webhook payload');
    }

    let payment: PaymentWithRelations | null = null;
    if (parsed.providerOrderId) {
      const attempt = await paymentRepository.findAttemptByProviderOrderId(provider.name, parsed.providerOrderId);
      if (attempt) payment = await paymentRepository.findById(attempt.paymentId);
    }

    const event = await paymentRepository.createWebhookEvent({
      provider: provider.name,
      providerEventId: parsed.providerEventId,
      eventType: parsed.eventType,
      paymentId: payment?.id ?? null,
      payload: JSON.parse(rawBody.toString('utf8')) as object,
    });
    if (!event) {
      // Duplicate delivery of an event we've already recorded — no-op by design.
      recordAuditLog({ actorUserId: null, action: 'payment.webhook_duplicate', entityType: 'PaymentWebhookEvent', entityId: parsed.providerEventId, metadata: { provider: provider.name } });
      return;
    }

    if (!payment) {
      await paymentRepository.markWebhookProcessed(event.id);
      recordAuditLog({ actorUserId: null, action: 'payment.webhook_unresolved', entityType: 'PaymentWebhookEvent', entityId: event.id, metadata: { provider: provider.name, eventType: parsed.eventType } });
      return;
    }

    const attempt = payment.attempts.find((a) => a.providerOrderId === parsed.providerOrderId) ?? payment.attempts[0];

    if (parsed.status === 'captured') {
      if (parsed.amount !== null && Math.abs(parsed.amount - Number(payment.amount)) > 0.01) {
        recordAuditLog({ actorUserId: null, action: 'payment.webhook_amount_mismatch', entityType: 'Payment', entityId: payment.id, clinicId: payment.clinicId, metadata: { expected: Number(payment.amount), received: parsed.amount } });
      } else if (parsed.providerPaymentId) {
        await applyCapture(payment, attempt?.id, {
          providerPaymentId: parsed.providerPaymentId,
          providerOrderId: parsed.providerOrderId ?? '',
          status: 'captured',
          amount: parsed.amount ?? Number(payment.amount),
          currency: payment.currency,
          method: parsed.method,
        });
      }
    } else if (parsed.status === 'failed') {
      await applyFailure(payment, attempt?.id, parsed.failureCode, parsed.failureMessage);
    }
    // 'refunded' webhook confirmations are accepted as informational — the refund endpoint's own
    // provider call already drives Refund/Payment state synchronously; no extra transition here.

    await paymentRepository.markWebhookProcessed(event.id);
    recordAuditLog({ actorUserId: null, action: 'payment.webhook_received', entityType: 'Payment', entityId: payment.id, clinicId: payment.clinicId, metadata: { eventType: parsed.eventType } });
  },

  async getById(userId: string, role: UserRole, paymentId: string): Promise<PaymentDto> {
    let payment = await paymentRepository.findById(paymentId);
    if (!payment) throw new NotFoundError('Payment');
    if (role === 'PATIENT') {
      if (payment.appointment.patient.userId !== userId) throw new NotFoundError('Payment');
    } else {
      await assertClinicCanViewPayment(userId, role, payment);
    }
    payment = await expireIfStale(payment);
    return toPaymentDto(payment);
  },

  async getStatus(userId: string, role: UserRole, paymentId: string): Promise<{ status: PaymentTransactionStatus; expiresAt: string }> {
    const dto = await this.getById(userId, role, paymentId);
    return { status: dto.status, expiresAt: dto.expiresAt };
  },

  async getReceiptPdf(userId: string, role: UserRole, paymentId: string): Promise<{ buffer: Buffer; filename: string }> {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) throw new NotFoundError('Payment');
    if (role === 'PATIENT') {
      if (payment.appointment.patient.userId !== userId) throw new NotFoundError('Payment');
    } else {
      await assertClinicCanViewPayment(userId, role, payment);
    }
    if (!payment.invoice) {
      throw new ConflictError('No invoice is available for this payment yet');
    }

    const buffer = await generateInvoicePdf({
      invoiceNumber: payment.invoice.invoiceNumber,
      issuedAt: payment.invoice.issuedAt,
      clinicName: payment.appointment.clinic.name,
      clinicAddress: [payment.appointment.clinic.addressLine1, payment.appointment.clinic.city].filter(Boolean).join(', ') || null,
      doctorName: payment.appointment.doctor.displayName,
      patientName: payment.appointment.patient.fullName,
      bookingReference: payment.appointment.bookingReference,
      appointmentDate: payment.appointment.scheduledAt,
      subtotal: Number(payment.invoice.subtotal),
      discount: Number(payment.invoice.discount),
      tax: Number(payment.invoice.tax),
      total: Number(payment.invoice.total),
      currency: payment.invoice.currency,
      status: payment.invoice.status,
      method: payment.invoice.method,
    });

    recordAuditLog({
      actorUserId: userId,
      action: 'invoice.downloaded',
      entityType: 'Invoice',
      entityId: payment.invoice.id,
      clinicId: payment.clinicId,
      metadata: { invoiceNumber: payment.invoice.invoiceNumber },
    });

    return { buffer, filename: `${payment.invoice.invoiceNumber}.pdf` };
  },

  async listMyPayments(userId: string, query: PaymentListQuery): Promise<PaginatedResult<PaymentSummaryDto>> {
    const patient = await patientRepository.findByUserId(userId);
    if (!patient) throw new NotFoundError('Patient profile');
    const { items, total } = await paymentRepository.listForPatient(patient.id, query.page, query.limit);
    return { items: items.map(toPaymentSummaryDto), page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) };
  },

  async refund(userId: string, role: UserRole, paymentId: string, input: RefundPaymentInput): Promise<PaymentDto> {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) throw new NotFoundError('Payment');
    await assertClinicPermission(userId, role, payment.clinicId, CLINIC_PERMISSIONS.PAYMENT_REFUND);

    if (payment.status !== 'CAPTURED' && payment.status !== 'PARTIALLY_REFUNDED') {
      throw new ConflictError(`Cannot refund a payment in status ${payment.status}`);
    }
    const capturedTotal = Number(payment.capturedAmount ?? payment.amount);
    const remaining = capturedTotal - Number(payment.refundedAmount);
    const eligibility = await calculateRefundEligibility(payment.clinicId, remaining);
    const requestedAmount = input.amount ?? eligibility.eligibleAmount;
    if (requestedAmount <= 0) throw new ValidationError('No refundable amount available');
    if (requestedAmount - remaining > 0.01) throw new ValidationError('Refund amount exceeds the remaining refundable balance');

    const result = await performRefund(payment, { amount: requestedAmount, reason: input.reason, actorUserId: userId });
    return toPaymentDto(result);
  },

  /** Called by appointments.service.ts / reception-appointments.service.ts after a booking
   * cancellation succeeds — not by booking.engine.ts directly (payment.engine.ts depends on
   * booking.engine.ts, never the reverse, to avoid a circular import). No-ops if the appointment
   * never had a payment. Auto-triggers a policy-eligible refund for an already-captured payment,
   * satisfying the "payment success -> cancellation -> refund" flow. */
  async handleAppointmentCancelled(appointmentId: string, actorUserId: string): Promise<void> {
    const payment = await paymentRepository.findByAppointmentId(appointmentId);
    if (!payment) return;

    if (ACTIVE_PAYMENT_STATUSES.has(payment.status)) {
      const claimed = await prisma.payment.updateMany({ where: { id: payment.id, status: payment.status }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
      if (claimed.count === 1) {
        recordAuditLog({ actorUserId, action: 'payment.cancelled', entityType: 'Payment', entityId: payment.id, clinicId: payment.clinicId, metadata: { appointmentId } });
      }
      return;
    }

    if (payment.status === 'CAPTURED' || payment.status === 'PARTIALLY_REFUNDED') {
      const capturedTotal = Number(payment.capturedAmount ?? payment.amount);
      const remaining = capturedTotal - Number(payment.refundedAmount);
      const eligibility = await calculateRefundEligibility(payment.clinicId, remaining);
      if (eligibility.eligibleAmount > 0) {
        await performRefund(payment, { amount: eligibility.eligibleAmount, reason: 'Appointment cancelled', actorUserId });
      }
    }
  },

  async getClinicBilling(userId: string, role: UserRole, query: ClinicBillingQuery): Promise<{ summary: ClinicBillingSummaryDto; items: PaginatedResult<ClinicBillingRowDto> }> {
    await assertClinicPermission(userId, role, query.clinicId, CLINIC_PERMISSIONS.BILLING_VIEW);

    const [totals, listResult, settings] = await Promise.all([
      paymentRepository.clinicBillingTotals(query.clinicId),
      paymentRepository.listForClinicBilling({
        clinicId: query.clinicId,
        doctorId: query.doctorId,
        patientId: query.patientId,
        status: query.status,
        method: query.method,
        from: query.from ? new Date(`${query.from}T00:00:00.000Z`) : undefined,
        to: query.to ? new Date(`${query.to}T23:59:59.999Z`) : undefined,
        page: query.page,
        limit: query.limit,
      }),
      prisma.clinicSettings.findUnique({ where: { clinicId: query.clinicId } }),
    ]);
    const currency = settings?.currency ?? 'INR';

    return {
      summary: { ...totals, currency },
      items: {
        items: listResult.items.map(
          (p): ClinicBillingRowDto => ({
            paymentId: p.id,
            appointmentId: p.appointmentId,
            bookingReference: p.appointment.bookingReference,
            patientName: p.appointment.patient.fullName,
            doctorName: p.appointment.doctor.displayName,
            status: p.status,
            amount: Number(p.amount),
            currency: p.currency,
            method: p.method,
            createdAt: p.createdAt.toISOString(),
          }),
        ),
        page: query.page,
        limit: query.limit,
        total: listResult.total,
        totalPages: Math.max(1, Math.ceil(listResult.total / query.limit)),
      },
    };
  },
};

/** Internal — no authorization here, callers (`refund`, `handleAppointmentCancelled`) are
 * responsible for authorizing before invoking this. Atomically claims the CAPTURED/PARTIALLY_REFUNDED
 * -> REFUND_PENDING transition so two simultaneous refund requests can never both proceed (the
 * mandatory "two refund requests simultaneously" concurrency test). */
async function performRefund(payment: PaymentWithRelations, input: { amount: number; reason: string; actorUserId: string }): Promise<PaymentWithRelations> {
  assertTransition(payment.status, 'REFUND_PENDING');
  const claimed = await prisma.payment.updateMany({ where: { id: payment.id, status: payment.status }, data: { status: 'REFUND_PENDING' } });
  if (claimed.count !== 1) {
    throw new ConflictError('A refund is already in progress for this payment');
  }

  const refundRow = await paymentRepository.createRefund({ paymentId: payment.id, amount: input.amount, reason: input.reason, actorUserId: input.actorUserId });

  try {
    if (!payment.providerPaymentId) throw new Error('No provider payment id to refund');
    const provider = getProviderByName(payment.provider);
    const providerResult = await provider.createRefund({ providerPaymentId: payment.providerPaymentId, amount: input.amount, reason: input.reason });

    const capturedTotal = Number(payment.capturedAmount ?? payment.amount);
    const newRefundedAmount = Number(payment.refundedAmount) + input.amount;
    const isFull = capturedTotal - newRefundedAmount <= 0.01;
    const finalStatus: PaymentTransactionStatus = isFull ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

    await paymentRepository.updateRefund(refundRow.id, { status: isFull ? 'REFUNDED' : 'PARTIALLY_REFUNDED', providerRefundId: providerResult.providerRefundId });
    await paymentRepository.updateStatus(payment.id, { status: finalStatus, refundedAmount: newRefundedAmount });

    recordAuditLog({
      actorUserId: input.actorUserId,
      action: isFull ? 'payment.refunded' : 'payment.partially_refunded',
      entityType: 'Payment',
      entityId: payment.id,
      clinicId: payment.clinicId,
      metadata: { amount: input.amount, reason: input.reason },
    });
    await notifyUser({
      userId: payment.appointment.patient.userId,
      type: NotificationType.APPOINTMENT_UPDATE,
      title: isFull ? 'Refund completed' : 'Partial refund completed',
      message: `A refund of ${payment.currency} ${input.amount} for ${payment.appointment.bookingReference} has been processed.`,
      relatedEntityType: 'Appointment',
      relatedEntityId: payment.appointmentId,
    });
    emitToClinicRoom(payment.clinicId, SOCKET_EVENTS.PAYMENT.REFUNDED, { paymentId: payment.id, clinicId: payment.clinicId, amount: input.amount });
    emitToUserRoom(payment.appointment.patient.userId, SOCKET_EVENTS.PAYMENT.REFUNDED, { paymentId: payment.id });

    return refetch(payment.id);
  } catch (err) {
    await paymentRepository.updateRefund(refundRow.id, { status: 'FAILED', failureMessage: 'Refund could not be processed by the payment provider' });
    await paymentRepository.updateStatus(payment.id, { status: payment.status }); // roll back to the pre-refund-attempt state
    recordAuditLog({
      actorUserId: input.actorUserId,
      action: 'payment.refund_failed',
      entityType: 'Payment',
      entityId: payment.id,
      clinicId: payment.clinicId,
      metadata: { amount: input.amount },
    });
    if (err instanceof AppError) throw err;
    throw new AppError(502, ErrorCode.INTERNAL_ERROR, 'Refund could not be processed');
  }
}
