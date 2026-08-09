import { NotificationType } from '@prisma/client';
import type { NotificationListQuery, NotificationPreferenceInput, PaginatedResult } from '@clinic/shared';
import type { NotificationDto } from '@clinic/shared';
import { notificationsRepository } from './notifications.repository.js';
import { DEFAULT_PREFERENCE_DTO, toNotificationDto, toPreferenceDto } from './notifications.mappers.js';

/** Reusable by any module that needs to notify a patient (currently: appointment cancellation). */
export async function notifyUser(input: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}): Promise<void> {
  await notificationsRepository.create(input);
}

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

  markRead(userId: string, id: string) {
    return notificationsRepository.markRead(id, userId);
  },

  markAllRead(userId: string) {
    return notificationsRepository.markAllRead(userId);
  },

  async getPreference(userId: string) {
    const pref = await notificationsRepository.getPreference(userId);
    return pref ? toPreferenceDto(pref) : DEFAULT_PREFERENCE_DTO;
  },

  async updatePreference(userId: string, input: NotificationPreferenceInput) {
    const pref = await notificationsRepository.upsertPreference(userId, input);
    return toPreferenceDto(pref);
  },
};

export { NotificationType };
