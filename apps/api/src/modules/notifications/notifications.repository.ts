import type { NotificationType } from '@prisma/client';
import { prisma } from '../../config/database.js';

export const notificationsRepository = {
  create(input: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
  }) {
    return prisma.notification.create({ data: input });
  },

  async list(userId: string, unreadOnly: boolean | undefined, page: number, limit: number) {
    const where = { userId, ...(unreadOnly ? { isRead: false } : {}) };
    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);
    return { items, total };
  },

  countUnread(userId: string) {
    return prisma.notification.count({ where: { userId, isRead: false } });
  },

  markRead(id: string, userId: string) {
    return prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
  },

  markAllRead(userId: string) {
    return prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  },

  getPreference(userId: string) {
    return prisma.notificationPreference.findUnique({ where: { userId } });
  },

  upsertPreference(
    userId: string,
    data: {
      appointmentUpdates: boolean;
      queueUpdates: boolean;
      prescriptionReady: boolean;
      reportReady: boolean;
      channel: 'EMAIL' | 'SMS' | 'BOTH' | 'NONE';
    },
  ) {
    return prisma.notificationPreference.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  },
};
