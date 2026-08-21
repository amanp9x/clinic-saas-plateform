import { NotificationType, type SettlementStatus } from '@prisma/client';
import type {
  ApproveSettlementInput,
  DoctorSettlementsQuery,
  MarkSettlementPaidInput,
  PaginatedResult,
  PlatformSettlementsQuery,
  RejectSettlementInput,
  RequestSettlementInput,
  SettlementRequestDto,
} from '@clinic/shared';
import { settlementRepository } from './doctor-settlement.repository.js';
import { toSettlementRequestDto } from './doctor-settlement.mappers.js';
import { resolveDoctorOrThrow, resolveUnsettledEarnings } from '../doctor/doctor.shared.js';
import { isUniqueConstraintError } from '../doctor-queue/queue.repository.js';
import { notifyUser } from '../notifications/notification-dispatch.service.js';
import { settlementStatusUpdatedEmail } from '../notifications/email/templates.js';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';

/** REQUESTED is absent as a target — nothing ever transitions back to it, same convention as
 * every other small admin-reviewed lifecycle in this codebase (contact messages, refill requests,
 * support tickets). */
const ALLOWED_ADMIN_TRANSITIONS: Record<SettlementStatus, SettlementStatus[]> = {
  REQUESTED: ['APPROVED', 'REJECTED'],
  APPROVED: ['REJECTED', 'PAID'],
  REJECTED: [],
  PAID: [],
};

function settlementsUrl(): string {
  return `${env.WEB_URL}/doctor/earnings`;
}

async function notifyDoctorOfOutcome(request: { id: string; doctorId: string; amount: unknown; currency: string; status: 'APPROVED' | 'REJECTED' | 'PAID' }, reviewNotes: string | null) {
  const doctor = await prisma.doctor.findUniqueOrThrow({ where: { id: request.doctorId }, select: { userId: true, displayName: true } });
  const user = await prisma.user.findUnique({ where: { id: doctor.userId }, select: { email: true } });
  const amount = String(request.amount);
  const title =
    request.status === 'PAID' ? 'Settlement paid' : request.status === 'APPROVED' ? 'Settlement request approved' : 'Settlement request rejected';
  const message =
    request.status === 'PAID'
      ? `Your settlement of ${request.currency} ${amount} has been marked as paid.`
      : request.status === 'APPROVED'
        ? `Your settlement request for ${request.currency} ${amount} was approved and is awaiting payout.`
        : `Your settlement request for ${request.currency} ${amount} was rejected.${reviewNotes ? ` Reason: ${reviewNotes}` : ''}`;

  await notifyUser({
    userId: doctor.userId,
    type: NotificationType.SETTLEMENT_STATUS_UPDATED,
    title,
    message,
    relatedEntityType: 'SettlementRequest',
    relatedEntityId: request.id,
    actionUrl: '/doctor/earnings',
    notificationKey: `settlement:${request.id}:${request.status}`,
    email: user?.email
      ? settlementStatusUpdatedEmail({ doctorName: doctor.displayName, amount, currency: request.currency, status: request.status, reviewNotes, actionUrl: settlementsUrl() })
      : undefined,
  });
}

export const doctorSettlementService = {
  async request(userId: string, input: RequestSettlementInput): Promise<SettlementRequestDto> {
    const doctor = await resolveDoctorOrThrow(userId);
    const { periodStart, periodEnd, amount } = await resolveUnsettledEarnings(doctor.id, doctor.createdAt);

    if (amount <= 0) {
      throw new ValidationError('There are no unsettled earnings to request right now');
    }

    let created;
    try {
      created = await settlementRepository.create({
        doctorId: doctor.id,
        periodStart,
        periodEnd,
        amount,
        doctorNotes: input.notes?.trim() || null,
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new ConflictError('You already have an active settlement request awaiting a decision');
      }
      throw err;
    }

    recordAuditLog({
      actorUserId: userId,
      action: 'doctor.settlement_requested',
      entityType: 'SettlementRequest',
      entityId: created.id,
      metadata: { amount, periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString() },
    });

    return toSettlementRequestDto(created);
  },

  async listForDoctor(userId: string, query: DoctorSettlementsQuery): Promise<PaginatedResult<SettlementRequestDto>> {
    const doctor = await resolveDoctorOrThrow(userId);
    const { items, total } = await settlementRepository.listForDoctor(doctor.id, { status: query.status }, query.page, query.limit);
    return { items: items.map(toSettlementRequestDto), page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) };
  },

  async listForPlatform(query: PlatformSettlementsQuery): Promise<PaginatedResult<SettlementRequestDto>> {
    const { items, total } = await settlementRepository.listForPlatform({ status: query.status }, query.page, query.limit);
    return { items: items.map(toSettlementRequestDto), page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) };
  },

  async getDetailForPlatform(id: string): Promise<SettlementRequestDto> {
    const request = await settlementRepository.findById(id);
    if (!request) throw new NotFoundError('Settlement request');
    return toSettlementRequestDto(request);
  },

  async approve(actorUserId: string, id: string, input: ApproveSettlementInput): Promise<SettlementRequestDto> {
    const existing = await settlementRepository.findById(id);
    if (!existing) throw new NotFoundError('Settlement request');
    if (!ALLOWED_ADMIN_TRANSITIONS[existing.status].includes('APPROVED')) {
      throw new ConflictError(`Cannot move a settlement request from ${existing.status} to APPROVED`);
    }

    const reviewNotes = input.reviewNotes?.trim() || null;
    const claimed = await settlementRepository.claimTransition(id, existing.status, { status: 'APPROVED', respondedByUserId: actorUserId, reviewNotes });
    if (claimed !== 1) throw new ConflictError('This request was already updated by someone else');

    recordAuditLog({ actorUserId, action: 'platform.settlement_approved', entityType: 'SettlementRequest', entityId: id, metadata: { reviewNotes } });
    await notifyDoctorOfOutcome({ id, doctorId: existing.doctorId, amount: existing.amount, currency: existing.currency, status: 'APPROVED' }, reviewNotes);

    const final = await settlementRepository.findById(id);
    return toSettlementRequestDto(final!);
  },

  async reject(actorUserId: string, id: string, input: RejectSettlementInput): Promise<SettlementRequestDto> {
    const existing = await settlementRepository.findById(id);
    if (!existing) throw new NotFoundError('Settlement request');
    if (!ALLOWED_ADMIN_TRANSITIONS[existing.status].includes('REJECTED')) {
      throw new ConflictError(`Cannot move a settlement request from ${existing.status} to REJECTED`);
    }

    const reviewNotes = input.reviewNotes.trim();
    const claimed = await settlementRepository.claimTransition(id, existing.status, { status: 'REJECTED', respondedByUserId: actorUserId, reviewNotes });
    if (claimed !== 1) throw new ConflictError('This request was already updated by someone else');

    recordAuditLog({ actorUserId, action: 'platform.settlement_rejected', entityType: 'SettlementRequest', entityId: id, metadata: { reviewNotes } });
    await notifyDoctorOfOutcome({ id, doctorId: existing.doctorId, amount: existing.amount, currency: existing.currency, status: 'REJECTED' }, reviewNotes);

    const final = await settlementRepository.findById(id);
    return toSettlementRequestDto(final!);
  },

  async markPaid(actorUserId: string, id: string, input: MarkSettlementPaidInput): Promise<SettlementRequestDto> {
    const existing = await settlementRepository.findById(id);
    if (!existing) throw new NotFoundError('Settlement request');
    if (!ALLOWED_ADMIN_TRANSITIONS[existing.status].includes('PAID')) {
      throw new ConflictError(`Cannot move a settlement request from ${existing.status} to PAID`);
    }

    const reviewNotes = input.reviewNotes?.trim() || null;
    const claimed = await settlementRepository.claimTransition(id, existing.status, { status: 'PAID', respondedByUserId: actorUserId, reviewNotes, paidAt: new Date() });
    if (claimed !== 1) throw new ConflictError('This request was already updated by someone else');

    recordAuditLog({ actorUserId, action: 'platform.settlement_paid', entityType: 'SettlementRequest', entityId: id, metadata: { reviewNotes } });
    await notifyDoctorOfOutcome({ id, doctorId: existing.doctorId, amount: existing.amount, currency: existing.currency, status: 'PAID' }, reviewNotes);

    const final = await settlementRepository.findById(id);
    return toSettlementRequestDto(final!);
  },
};
