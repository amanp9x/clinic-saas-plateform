import type { SettlementRequestDto } from '@clinic/shared';
import type { SettlementRequestWithRelations } from './doctor-settlement.repository.js';

export function toSettlementRequestDto(request: SettlementRequestWithRelations): SettlementRequestDto {
  return {
    id: request.id,
    doctorId: request.doctorId,
    doctorName: request.doctor.displayName,
    periodStart: request.periodStart.toISOString(),
    periodEnd: request.periodEnd.toISOString(),
    amount: request.amount.toString(),
    currency: request.currency,
    status: request.status,
    doctorNotes: request.doctorNotes,
    respondedAt: request.respondedAt ? request.respondedAt.toISOString() : null,
    reviewNotes: request.reviewNotes,
    paidAt: request.paidAt ? request.paidAt.toISOString() : null,
    createdAt: request.createdAt.toISOString(),
  };
}
