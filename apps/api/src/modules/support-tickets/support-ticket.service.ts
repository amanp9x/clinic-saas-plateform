import type { CreateSupportTicketInput, MySupportTicketsQuery, PaginatedResult, SupportTicketDetailDto, SupportTicketMessageInput, SupportTicketRowDto } from '@clinic/shared';
import { patientRepository } from '../patient/patient.repository.js';
import { supportTicketRepository } from './support-ticket.repository.js';
import { toSupportTicketDetailDto, toSupportTicketRowDto } from './support-ticket.mappers.js';
import { generateTicketNumber } from './ticket-number.util.js';
import { ConflictError, NotFoundError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';

/** Resolves the ticket for a patient action and enforces ownership — 404, not 403, for a
 * foreign ticket (same IDOR-safe convention as review/payment ownership checks throughout this
 * codebase — never confirms existence to a non-owner). */
async function resolveOwnedTicket(userId: string, ticketId: string) {
  const ticket = await supportTicketRepository.findDetailById(ticketId);
  if (!ticket || ticket.raisedByUserId !== userId) {
    throw new NotFoundError('Support ticket');
  }
  return ticket;
}

export const supportTicketService = {
  async create(userId: string, input: CreateSupportTicketInput): Promise<SupportTicketDetailDto> {
    const patient = await patientRepository.findByUserIdOrThrow(userId);

    let clinicId: string | null = null;
    let appointmentId: string | null = null;
    let paymentId: string | null = null;

    // clinicId is always derived from the linked resource's own ownership-checked record —
    // never accepted directly from the client, even implicitly.
    if (input.appointmentId) {
      const appointment = await supportTicketRepository.findOwnedAppointment(input.appointmentId, patient.id);
      if (!appointment) throw new NotFoundError('Appointment');
      appointmentId = appointment.id;
      clinicId = appointment.clinicId;
    }
    if (input.paymentId) {
      const payment = await supportTicketRepository.findOwnedPayment(input.paymentId, patient.id);
      if (!payment) throw new NotFoundError('Payment');
      paymentId = payment.id;
      clinicId = clinicId ?? payment.clinicId;
    }

    const ticket = await supportTicketRepository.create({
      ticketNumber: generateTicketNumber(),
      raisedByUserId: userId,
      clinicId,
      appointmentId,
      paymentId,
      category: input.category,
      subject: input.subject,
      description: input.description,
    });

    recordAuditLog({
      actorUserId: userId,
      action: 'support_ticket.created',
      entityType: 'SupportTicket',
      entityId: ticket.id,
      clinicId: clinicId ?? undefined,
      metadata: { category: input.category, appointmentId, paymentId },
    });

    return toSupportTicketDetailDto(ticket);
  },

  async listMy(userId: string, query: MySupportTicketsQuery): Promise<PaginatedResult<SupportTicketRowDto>> {
    const { items, total } = await supportTicketRepository.listForUser(userId, { status: query.status, page: query.page, limit: query.limit });
    return { items: items.map(toSupportTicketRowDto), page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) };
  },

  async getMyDetail(userId: string, ticketId: string): Promise<SupportTicketDetailDto> {
    const ticket = await resolveOwnedTicket(userId, ticketId);
    return toSupportTicketDetailDto(ticket);
  },

  async addMyMessage(userId: string, ticketId: string, input: SupportTicketMessageInput): Promise<SupportTicketDetailDto> {
    const ticket = await resolveOwnedTicket(userId, ticketId);
    if (ticket.status === 'CLOSED') {
      throw new ConflictError('This ticket is closed and can no longer receive messages');
    }
    await supportTicketRepository.addMessage(ticketId, userId, input.message);
    recordAuditLog({ actorUserId: userId, action: 'support_ticket.message_added', entityType: 'SupportTicket', entityId: ticketId, clinicId: ticket.clinicId ?? undefined });

    const updated = await supportTicketRepository.findDetailById(ticketId);
    return toSupportTicketDetailDto(updated!);
  },

  /** Patient withdraws a ticket that hasn't been picked up yet — the only self-service terminal
   * transition, mirroring how a patient can cancel their own appointment before it's acted on. */
  async withdraw(userId: string, ticketId: string): Promise<SupportTicketDetailDto> {
    const ticket = await resolveOwnedTicket(userId, ticketId);
    if (ticket.status !== 'OPEN') {
      throw new ConflictError('Only an open ticket that has not yet been picked up can be withdrawn');
    }
    const updated = await supportTicketRepository.updateStatus(ticketId, { status: 'CLOSED', closedAt: new Date() });
    recordAuditLog({ actorUserId: userId, action: 'support_ticket.withdrawn', entityType: 'SupportTicket', entityId: ticketId, clinicId: ticket.clinicId ?? undefined });
    return toSupportTicketDetailDto(updated);
  },

  /** Patient reopens a resolved ticket they're not satisfied with — moves it back into the admin
   * queue as IN_PROGRESS. Mirrors ClinicVerificationStatus's REJECTED -> UNDER_REVIEW precedent:
   * the previous resolutionNotes/resolvedAt are left in place as history, not cleared, until the
   * next resolution overwrites them. */
  async reopen(userId: string, ticketId: string): Promise<SupportTicketDetailDto> {
    const ticket = await resolveOwnedTicket(userId, ticketId);
    if (ticket.status !== 'RESOLVED') {
      throw new ConflictError('Only a resolved ticket can be reopened');
    }
    const updated = await supportTicketRepository.updateStatus(ticketId, { status: 'IN_PROGRESS' });
    recordAuditLog({ actorUserId: userId, action: 'support_ticket.reopened', entityType: 'SupportTicket', entityId: ticketId, clinicId: ticket.clinicId ?? undefined });
    return toSupportTicketDetailDto(updated);
  },
};
