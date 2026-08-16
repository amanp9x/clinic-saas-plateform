import type { NotificationListQuery, PaginatedResult } from '@clinic/shared';
import type { NotificationDto, NotificationPreferenceDto, NotificationPreferenceInput } from '@clinic/shared';
import { SOCKET_EVENTS } from '@clinic/shared';
import { notificationsRepository } from './notifications.repository.js';
import { DEFAULT_PREFERENCE_DTO, toNotificationDto, toPreferenceDto } from './notifications.mappers.js';
import { NotFoundError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';
import { emitToUserRoom } from '../../sockets/emit.js';

export const notificationsService = {
  async list(userId: string, query: NotificationListQuery): Promise<PaginatedResult<NotificationDto>> {
    const { items, total } = await notificationsRepository.list(
      userId,
      query.unreadOnly,
      query.page,
      query.limit,
    );
    return {
      items: items.map(toNotificationDto),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  },

  countUnread(userId: string) {
    return notificationsRepository.countUnread(userId);
  },

  async markRead(userId: string, id: string): Promise<void> {
    const owned = await notificationsRepository.findByIdForUser(id, userId);
    if (!owned) {
      throw new NotFoundError('Notification');
    }
    if (!owned.isRead) {
      await notificationsRepository.markRead(id, userId);
      const count = await notificationsRepository.countUnread(userId);
      emitToUserRoom(userId, SOCKET_EVENTS.NOTIFICATION.READ, { id });
      emitToUserRoom(userId, SOCKET_EVENTS.NOTIFICATION.UNREAD_COUNT_UPDATED, { count });
    }
  },

  async markAllRead(userId: string): Promise<void> {
    await notificationsRepository.markAllRead(userId);
    emitToUserRoom(userId, SOCKET_EVENTS.NOTIFICATION.UNREAD_COUNT_UPDATED, { count: 0 });
  },

  async delete(userId: string, id: string): Promise<void> {
    const owned = await notificationsRepository.findByIdForUser(id, userId);
    if (!owned) {
      throw new NotFoundError('Notification');
    }
    await notificationsRepository.deleteForUser(id, userId);
  },

  async getPreference(userId: string): Promise<NotificationPreferenceDto> {
    const pref = await notificationsRepository.getPreference(userId);
    return pref ? toPreferenceDto(pref) : DEFAULT_PREFERENCE_DTO;
  },

  async updatePreference(userId: string, input: NotificationPreferenceInput): Promise<NotificationPreferenceDto> {
    const pref = await notificationsRepository.upsertPreference(userId, input);
    recordAuditLog({ actorUserId: userId, action: 'notification.preference_updated', entityType: 'NotificationPreference', entityId: pref.id });
    return toPreferenceDto(pref);
  },
};
