import { NotificationType, type SupportTicketStatus } from '@prisma/client';
import { SOCKET_EVENTS } from '@clinic/shared';
import type {
  AdminUpdateSupportTicketStatusInput,
  PaginatedResult,
  PlatformSupportTicketsQuery,
  SupportTicketDetailDto,
  SupportTicketMessageInput,
  SupportTicketRowDto,
} from '@clinic/shared';
import { supportTicketRepository } from './support-ticket.repository.js';
import { toSupportTicketDetailDto, toSupportTicketRowDto } from './support-ticket.mappers.js';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';
import { emitToUserRoom } from '../../sockets/emit.js';
import { notifyUser } from '../notifications/notification-dispatch.service.js';
import { env } from '../../config/env.js';

/** Same "read, validate the one-hop transition, write" pattern as platform-admin.service.ts's
 * `ALLOWED_TRANSITIONS` — no application-level lock is needed because Postgres's own per-row
 * UPDATE atomicity is what the "two concurrent admin decisions never corrupt state" guarantee
 * actually rests on (see the concurrency test): both requests individually validate against
 * whatever they last read, both writes commit, and the row deterministically ends up holding
 * whichever one committed last — never a torn/partial state. OPEN is absent as a target — nothing
 * ever transitions back to OPEN once picked up. */
const ALLOWED_ADMIN_TRANSITIONS: Record<SupportTicketStatus, SupportTicketStatus[]> = {
  OPEN: ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

function ticketUrl(ticketId: string): string {
  return `${env.WEB_URL}/support/tickets/${ticketId}`;
}

export const platformSupportTicketsService = {
  async listTickets(query: PlatformSupportTicketsQuery): Promise<PaginatedResult<SupportTicketRowDto>> {
    const { items, total } = await supportTicketRepository.listForAdmin({
      status: query.status,
      category: query.category,
      clinicId: query.clinicId,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
    return { items: items.map(toSupportTicketRowDto), page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) };
  },

  async getDetail(ticketId: string): Promise<SupportTicketDetailDto> {
    const ticket = await supportTicketRepository.findDetailById(ticketId);
    if (!ticket) throw new NotFoundError('Support ticket');
    return toSupportTicketDetailDto(ticket);
  },

  async updateStatus(actorUserId: string, ticketId: string, input: AdminUpdateSupportTicketStatusInput): Promise<SupportTicketDetailDto> {
    const ticket = await supportTicketRepository.findDetailById(ticketId);
    if (!ticket) throw new NotFoundError('Support ticket');
    if (!ALLOWED_ADMIN_TRANSITIONS[ticket.status].includes(input.status)) {
      throw new ConflictError(`Cannot move a ticket from ${ticket.status} to ${input.status}`);
    }
    if (input.status === 'RESOLVED' && !input.resolutionNotes?.trim()) {
      throw new ValidationError('Resolution notes are required to resolve a ticket');
    }

    const now = new Date();
    const updated = await supportTicketRepository.updateStatus(ticketId, {
      status: input.status,
      resolutionNotes: input.status === 'RESOLVED' ? input.resolutionNotes || null : ticket.resolutionNotes,
      resolvedAt: input.status === 'RESOLVED' ? now : ticket.resolvedAt,
      resolvedByUserId: input.status === 'RESOLVED' ? actorUserId : ticket.resolvedByUserId,
      closedAt: input.status === 'CLOSED' ? now : ticket.closedAt,
    });

    recordAuditLog({
      actorUserId,
      action: 'platform.support_ticket_status_updated',
      entityType: 'SupportTicket',
      entityId: ticketId,
      clinicId: ticket.clinicId ?? undefined,
      metadata: { previousStatus: ticket.status, newStatus: input.status, resolutionNotes: input.resolutionNotes || null },
    });

    const outcomeLabel = input.status === 'RESOLVED' ? 'resolved' : input.status === 'CLOSED' ? 'closed' : 'picked up for review';
    await notifyUser({
      userId: ticket.raisedByUserId,
      type: NotificationType.SUPPORT_TICKET_UPDATE,
      title: `Your support ticket was ${outcomeLabel}`,
      message:
        input.status === 'RESOLVED' && input.resolutionNotes
          ? `${ticket.ticketNumber}: ${input.resolutionNotes}`
          : `${ticket.ticketNumber} (${ticket.subject}) has been ${outcomeLabel}.`,
      relatedEntityType: 'SupportTicket',
      relatedEntityId: ticketId,
      actionUrl: ticketUrl(ticketId),
      notificationKey: `support_ticket:${ticketId}:status:${input.status}:${now.getTime()}`,
    });
    emitToUserRoom(ticket.raisedByUserId, SOCKET_EVENTS.SUPPORT_TICKET.STATUS_UPDATED, { ticketId, status: input.status });

    return toSupportTicketDetailDto(updated);
  },

  async addMessage(actorUserId: string, ticketId: string, input: SupportTicketMessageInput): Promise<SupportTicketDetailDto> {
    const ticket = await supportTicketRepository.findDetailById(ticketId);
    if (!ticket) throw new NotFoundError('Support ticket');
    if (ticket.status === 'CLOSED') {
      throw new ConflictError('This ticket is closed and can no longer receive messages');
    }

    await supportTicketRepository.addMessage(ticketId, actorUserId, input.message);
    recordAuditLog({ actorUserId, action: 'platform.support_ticket_message_added', entityType: 'SupportTicket', entityId: ticketId, clinicId: ticket.clinicId ?? undefined });

    await notifyUser({
      userId: ticket.raisedByUserId,
      type: NotificationType.SUPPORT_TICKET_UPDATE,
      title: 'New reply on your support ticket',
      message: `${ticket.ticketNumber} (${ticket.subject}) has a new reply from support.`,
      relatedEntityType: 'SupportTicket',
      relatedEntityId: ticketId,
      actionUrl: ticketUrl(ticketId),
    });
    emitToUserRoom(ticket.raisedByUserId, SOCKET_EVENTS.SUPPORT_TICKET.MESSAGE_ADDED, { ticketId });

    const updated = await supportTicketRepository.findDetailById(ticketId);
    return toSupportTicketDetailDto(updated!);
  },
};
