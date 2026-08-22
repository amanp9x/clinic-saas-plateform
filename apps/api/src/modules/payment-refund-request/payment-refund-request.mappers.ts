import type { RefundRequestDto } from '@clinic/shared';
import type { RefundRequestWithRelations } from './payment-refund-request.repository.js';

export function toRefundRequestDto(request: RefundRequestWithRelations): RefundRequestDto {
  return {
    id: request.id,
    paymentId: request.paymentId,
    patientId: request.patientId,
    patientName: request.patient.fullName,
    clinicId: request.clinicId,
    clinicName: request.clinic.name,
    bookingReference: request.payment.appointment.bookingReference,
    amount: request.amount ? request.amount.toString() : null,
    reason: request.reason,
    status: request.status,
    respondedByUserId: request.respondedByUserId,
    respondedAt: request.respondedAt ? request.respondedAt.toISOString() : null,
    reviewNotes: request.reviewNotes,
    createdAt: request.createdAt.toISOString(),
  };
}
