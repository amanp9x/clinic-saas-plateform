import type { ContactMessageStatus } from '@prisma/client';
import type { AdminUpdateContactMessageStatusInput, ContactMessageDetailDto, ContactMessageRowDto, PaginatedResult, PlatformContactMessagesQuery } from '@clinic/shared';
import { contactRepository } from './contact.repository.js';
import { toContactMessageDetailDto, toContactMessageRowDto } from './contact.mappers.js';
import { sendEmail } from '../../services/mailer.service.js';
import { logger } from '../../config/logger.js';
import { ConflictError, NotFoundError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';

/** NEW is absent as a target — an admin only ever moves a message forward, never back to NEW,
 * same convention as ALLOWED_ADMIN_TRANSITIONS in platform-support-tickets.service.ts. */
const ALLOWED_ADMIN_TRANSITIONS: Record<ContactMessageStatus, ContactMessageStatus[]> = {
  NEW: ['IN_PROGRESS', 'RESOLVED'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: [],
};

export const platformContactMessagesService = {
  async list(query: PlatformContactMessagesQuery): Promise<PaginatedResult<ContactMessageRowDto>> {
    const { items, total } = await contactRepository.listForAdmin({ status: query.status, search: query.search }, query.page, query.limit);
    return {
      items: items.map(toContactMessageRowDto),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  },

  async getDetail(id: string): Promise<ContactMessageDetailDto> {
    const message = await contactRepository.findById(id);
    if (!message) throw new NotFoundError('Contact message');
    return toContactMessageDetailDto(message);
  },

  async updateStatus(actorUserId: string, id: string, input: AdminUpdateContactMessageStatusInput): Promise<ContactMessageDetailDto> {
    const existing = await contactRepository.findById(id);
    if (!existing) throw new NotFoundError('Contact message');
    if (!ALLOWED_ADMIN_TRANSITIONS[existing.status].includes(input.status)) {
      throw new ConflictError(`Cannot move a contact message from ${existing.status} to ${input.status}`);
    }

    const adminReply = input.adminReply?.trim() || null;
    const claimedCount = await contactRepository.claimStatusTransition(id, existing.status, {
      status: input.status,
      adminReply,
      respondedByUserId: actorUserId,
    });
    if (claimedCount !== 1) {
      // Lost the race to a concurrent update from another admin.
      throw new ConflictError('This message was already updated by another admin');
    }

    recordAuditLog({
      actorUserId,
      action: 'platform.contact_message_status_updated',
      entityType: 'ContactMessage',
      entityId: id,
      metadata: { previousStatus: existing.status, newStatus: input.status, repliedByEmail: Boolean(adminReply) },
    });

    if (adminReply) {
      // Best-effort — an email delivery failure must not fail a request whose status change has
      // already committed, same reasoning as notifyUser's own email step.
      await sendEmail({
        to: existing.email,
        subject: `Re: ${existing.subject}`,
        html: `<p>Hi ${existing.name},</p><p>${adminReply.replace(/\n/g, '<br/>')}</p>`,
        text: `Hi ${existing.name},\n\n${adminReply}`,
      }).catch((err: unknown) => logger.error({ err, id }, 'Failed to send contact message reply email'));
    }

    const updated = await contactRepository.findById(id);
    return toContactMessageDetailDto(updated!);
  },
};
