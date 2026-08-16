import type { NotificationPriority, NotificationType } from '@prisma/client';
import { prisma } from '../../config/database.js';

export const notificationsRepository = {
  create(input: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
    actionUrl?: string;
    notificationKey?: string;
    priority: NotificationPriority;
    expiresAt: Date | null;
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

  /** Indexed count-only query (userId+isRead composite index) — never fetches notification rows
   * just to compute this. */
  countUnread(userId: string) {
    return prisma.notification.count({ where: { userId, isRead: false } });
  },

  findByIdForUser(id: string, userId: string) {
    return prisma.notification.findFirst({ where: { id, userId } });
  },

  markRead(id: string, userId: string) {
    return prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
  },

  markAllRead(userId: string) {
    return prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  },

  deleteForUser(id: string, userId: string) {
    return prisma.notification.deleteMany({ where: { id, userId } });
  },

  getPreference(userId: string) {
    return prisma.notificationPreference.findUnique({ where: { userId } });
  },

  upsertPreference(
    userId: string,
    data: {
      appointmentEmail: boolean;
      appointmentInApp: boolean;
      paymentEmail: boolean;
      paymentInApp: boolean;
      queueEmail: boolean;
      queueInApp: boolean;
      prescriptionEmail: boolean;
      prescriptionInApp: boolean;
      announcementEmail: boolean;
      announcementInApp: boolean;
    },
  ) {
    return prisma.notificationPreference.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  },
};
