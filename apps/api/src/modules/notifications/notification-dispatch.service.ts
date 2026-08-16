import type { NotificationPriority, NotificationType } from '@prisma/client';
import { SOCKET_EVENTS } from '@clinic/shared';
import { prisma } from '../../config/database.js';
import { emitToUserRoom } from '../../sockets/emit.js';
import { isUniqueConstraintError } from '../doctor-queue/queue.repository.js';
import { notificationsRepository } from './notifications.repository.js';
import { toNotificationDto } from './notifications.mappers.js';
import { NOTIFICATION_TYPE_CONFIG, type NotificationCategory } from './notification-type-config.js';
import { deliverNotificationEmail } from './email-delivery.service.js';
import type { RenderedEmail } from './email/templates.js';

export interface DispatchNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  actionUrl?: string;
  /** Deterministic idempotency key (e.g. "payment:<id>:captured", "reminder:<apptId>:24h") — the
   * single mechanism the spec's "duplicate event -> exactly one notification" requirement relies
   * on. Omit for ad-hoc notifications that don't correspond to a dedupable source event. */
  notificationKey?: string;
  priority?: NotificationPriority;
  expiresAt?: Date | null;
  /** Pre-rendered email content (see email/templates.ts). Omit to skip email entirely (e.g. for
   * types that are in-app only, like QUEUE_PAUSED). */
  email?: RenderedEmail;
}

const CATEGORY_EMAIL_FIELD: Partial<Record<NotificationCategory, keyof import('@prisma/client').NotificationPreference>> = {
  appointment: 'appointmentEmail',
  payment: 'paymentEmail',
  queue: 'queueEmail',
  prescription: 'prescriptionEmail',
  announcement: 'announcementEmail',
};

async function shouldSendEmail(userId: string, category: NotificationCategory, tier: string): Promise<boolean> {
  if (tier !== 'OPTIONAL') return true; // TRANSACTIONAL/SECURITY are never suppressible
  const field = CATEGORY_EMAIL_FIELD[category];
  if (!field) return false; // no toggle exists for this category (e.g. reviews) — default off
  const pref = await notificationsRepository.getPreference(userId);
  if (!pref) return true; // no row yet — defaults are all-on per the schema's @default(true)
  return Boolean(pref[field]);
}

/**
 * The single centralized notification entry point — every module in the platform calls this
 * (never writes to the Notification table or emits NOTIFICATION.CREATED directly). Implements the
 * full "Application Event -> Notification Service -> Preference Check -> Template -> Delivery
 * Channel -> Delivery Record" pipeline from the architecture diagram in one place.
 */
export async function notifyUser(input: DispatchNotificationInput): Promise<void> {
  const config = NOTIFICATION_TYPE_CONFIG[input.type];
  const priority = input.priority ?? config.priority;
  const expiresAt = input.expiresAt !== undefined ? input.expiresAt : config.defaultExpiryMinutes ? new Date(Date.now() + config.defaultExpiryMinutes * 60_000) : null;

  let notification;
  try {
    notification = await notificationsRepository.create({
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      actionUrl: input.actionUrl,
      notificationKey: input.notificationKey,
      priority,
      expiresAt,
    });
  } catch (err) {
    if (input.notificationKey && isUniqueConstraintError(err)) {
      // Idempotent no-op: this exact event has already produced a notification.
      return;
    }
    throw err;
  }

  emitToUserRoom(input.userId, SOCKET_EVENTS.NOTIFICATION.CREATED, toNotificationDto(notification));
  const unreadCount = await notificationsRepository.countUnread(input.userId);
  emitToUserRoom(input.userId, SOCKET_EVENTS.NOTIFICATION.UNREAD_COUNT_UPDATED, { count: unreadCount });

  if (!input.email) return;
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { email: true } });
  if (!user?.email) return; // phone-only accounts simply have no email to deliver to
  if (!(await shouldSendEmail(input.userId, config.category, config.tier))) return;

  // Never let an email delivery failure surface to the caller — the in-app notification above is
  // already durably persisted regardless of what happens here.
  await deliverNotificationEmail({ notificationId: notification.id, recipientEmail: user.email, email: input.email }).catch(() => undefined);
}
