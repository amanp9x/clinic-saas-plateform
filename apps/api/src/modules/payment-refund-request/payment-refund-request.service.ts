import { NotificationType, type UserRole } from '@prisma/client';
import { CLINIC_PERMISSIONS } from '@clinic/shared';
import type { ApproveRefundRequestInput, ClinicRefundRequestsQuery, CreateRefundRequestInput, PaginatedResult, RefundRequestDto, RejectRefundRequestInput } from '@clinic/shared';
import { refundRequestRepository } from './payment-refund-request.repository.js';
import { toRefundRequestDto } from './payment-refund-request.mappers.js';
import { paymentRepository } from '../payments/payment.repository.js';
import { paymentEngine } from '../payments/payment.engine.js';
import { patientRepository } from '../patient/patient.repository.js';
import { assertClinicPermission } from '../reception/reception.shared.js';
import { isUniqueConstraintError } from '../doctor-queue/queue.repository.js';
import { notifyUser } from '../notifications/notification-dispatch.service.js';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';

async function resolvePatientOrThrow(userId: string) {
  const patient = await patientRepository.findByUserId(userId);
  if (!patient) throw new NotFoundError('Patient profile');
  return patient;
}

/** 404, not 403, for a foreign payment — never confirms existence to a non-owner. Same convention
 * `payment.engine.ts::getOwnedPaymentForPatient` already uses for every other patient-owned
 * payment action (verify, retry, simulate). */
async function getOwnedPaymentOrThrow(userId: string, paymentId: string) {
  const payment = await paymentRepository.findById(paymentId);
  if (!payment || payment.appointment.patient.userId !== userId) {
    throw new NotFoundError('Payment');
  }
  return payment;
}

export const refundRequestService = {
  async request(userId: string, paymentId: string, input: CreateRefundRequestInput): Promise<RefundRequestDto> {
    const patient = await resolvePatientOrThrow(userId);
    const payment = await getOwnedPaymentOrThrow(userId, paymentId);

    if (payment.status !== 'CAPTURED' && payment.status !== 'PARTIALLY_REFUNDED') {
      throw new ConflictError(`Cannot request a refund for a payment in status ${payment.status}`);
    }
    const capturedTotal = Number(payment.capturedAmount ?? payment.amount);
    const remaining = capturedTotal - Number(payment.refundedAmount);
    if (remaining <= 0) {
      throw new ValidationError('No refundable amount available for this payment');
    }
    // `input.amount` undefined stays undefined here (never defaulted to `remaining`) — the actual
    // eligible amount is computed once, freshly, by `paymentEngine.refund` at approval time, so a
    // request sitting unreviewed for a while never bakes in a stale eligibility snapshot.
    if (input.amount !== undefined && input.amount - remaining > 0.01) {
      throw new ValidationError('Refund amount exceeds the remaining refundable balance');
    }

    let created;
    try {
      created = await refundRequestRepository.create({
        paymentId: payment.id,
        patientId: patient.id,
        clinicId: payment.clinicId,
        amount: input.amount ?? null,
        reason: input.reason.trim(),
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new ConflictError('You already have an active refund request for this payment');
      }
      throw err;
    }

    recordAuditLog({
      actorUserId: userId,
      action: 'patient.refund_requested',
      entityType: 'RefundRequest',
      entityId: created.id,
      clinicId: payment.clinicId,
      metadata: { paymentId: payment.id, amount: input.amount ?? null },
    });

    const admins = await refundRequestRepository.clinicAdminUserIds(payment.clinicId);
    for (const admin of admins) {
      await notifyUser({
        userId: admin.userId,
        type: NotificationType.PAYMENT_REFUND_PENDING,
        title: 'New refund request',
        message: `${patient.fullName} requested a refund for ${payment.appointment.bookingReference}.`,
        relatedEntityType: 'RefundRequest',
        relatedEntityId: created.id,
        actionUrl: `/clinic/billing`,
        notificationKey: `refund-request:${created.id}:submitted:${admin.userId}`,
      });
    }

    return toRefundRequestDto(created);
  },

  async listForClinic(userId: string, role: UserRole, query: ClinicRefundRequestsQuery): Promise<PaginatedResult<RefundRequestDto>> {
    await assertClinicPermission(userId, role, query.clinicId, CLINIC_PERMISSIONS.PAYMENT_REFUND);
    const { items, total } = await refundRequestRepository.listForClinic(query.clinicId, { status: query.status }, query.page, query.limit);
    return { items: items.map(toRefundRequestDto), page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) };
  },

  async approve(actorUserId: string, role: UserRole, id: string, input: ApproveRefundRequestInput): Promise<RefundRequestDto> {
    const existing = await refundRequestRepository.findById(id);
    if (!existing) throw new NotFoundError('Refund request');
    await assertClinicPermission(actorUserId, role, existing.clinicId, CLINIC_PERMISSIONS.PAYMENT_REFUND);
    if (existing.status !== 'REQUESTED') {
      throw new ConflictError(`Cannot approve a refund request in status ${existing.status}`);
    }

    const reviewNotes = input.reviewNotes?.trim() || null;
    const claimed = await refundRequestRepository.claimTransition(id, { status: 'APPROVED', respondedByUserId: actorUserId, reviewNotes });
    if (claimed !== 1) {
      throw new ConflictError('This request was already decided by someone else');
    }

    // Reuse the existing, unmodified refund engine end to end (gateway call, bookkeeping, audit,
    // notification, email, socket, invoice sync all already happen inside it) — this layer never
    // duplicates any of that. `existing.amount` null means "the full eligible amount," exactly
    // `RefundPaymentInput.amount`'s own optional-means-full-refund convention.
    try {
      await paymentEngine.refund(actorUserId, role, existing.paymentId, {
        amount: existing.amount ? Number(existing.amount) : undefined,
        reason: existing.reason,
      });
    } catch (err) {
      // Do not leave this falsely APPROVED if the actual refund failed — revert to REQUESTED so
      // staff can retry, mirroring `performRefund`'s own rollback-to-prior-status behavior.
      await refundRequestRepository.revertToRequested(id);
      throw err;
    }

    recordAuditLog({
      actorUserId,
      action: 'clinic.refund_request_approved',
      entityType: 'RefundRequest',
      entityId: id,
      clinicId: existing.clinicId,
      metadata: { paymentId: existing.paymentId, amount: existing.amount ? Number(existing.amount) : null },
    });

    const final = await refundRequestRepository.findById(id);
    return toRefundRequestDto(final!);
  },

  async reject(actorUserId: string, role: UserRole, id: string, input: RejectRefundRequestInput): Promise<RefundRequestDto> {
    const existing = await refundRequestRepository.findById(id);
    if (!existing) throw new NotFoundError('Refund request');
    await assertClinicPermission(actorUserId, role, existing.clinicId, CLINIC_PERMISSIONS.PAYMENT_REFUND);
    if (existing.status !== 'REQUESTED') {
      throw new ConflictError(`Cannot reject a refund request in status ${existing.status}`);
    }

    const reviewNotes = input.reviewNotes.trim();
    const claimed = await refundRequestRepository.claimTransition(id, { status: 'REJECTED', respondedByUserId: actorUserId, reviewNotes });
    if (claimed !== 1) {
      throw new ConflictError('This request was already decided by someone else');
    }

    recordAuditLog({
      actorUserId,
      action: 'clinic.refund_request_rejected',
      entityType: 'RefundRequest',
      entityId: id,
      clinicId: existing.clinicId,
      metadata: { reviewNotes },
    });

    await notifyUser({
      userId: existing.patient.userId,
      type: NotificationType.PAYMENT_REFUND_REQUEST_REJECTED,
      title: 'Refund request declined',
      message: `Your refund request for ${existing.payment.appointment.bookingReference} was declined.${reviewNotes ? ` Reason: ${reviewNotes}` : ''}`,
      relatedEntityType: 'RefundRequest',
      relatedEntityId: id,
      actionUrl: `/appointments/${existing.payment.appointmentId}`,
      notificationKey: `refund-request:${id}:rejected`,
    });

    const final = await refundRequestRepository.findById(id);
    return toRefundRequestDto(final!);
  },
};
