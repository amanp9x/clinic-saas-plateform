import type { Notification, NotificationPreference } from '@prisma/client';
import type { NotificationDto, NotificationPreferenceDto } from '@clinic/shared';

export function toNotificationDto(notification: Notification): NotificationDto {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    isRead: notification.isRead,
    relatedEntityType: notification.relatedEntityType,
    relatedEntityId: notification.relatedEntityId,
    actionUrl: notification.actionUrl,
    priority: notification.priority,
    expiresAt: notification.expiresAt ? notification.expiresAt.toISOString() : null,
    createdAt: notification.createdAt.toISOString(),
  };
}

export function toPreferenceDto(pref: NotificationPreference): NotificationPreferenceDto {
  return {
    appointmentEmail: pref.appointmentEmail,
    appointmentInApp: pref.appointmentInApp,
    paymentEmail: pref.paymentEmail,
    paymentInApp: pref.paymentInApp,
    queueEmail: pref.queueEmail,
    queueInApp: pref.queueInApp,
    prescriptionEmail: pref.prescriptionEmail,
    prescriptionInApp: pref.prescriptionInApp,
    announcementEmail: pref.announcementEmail,
    announcementInApp: pref.announcementInApp,
  };
}

export const DEFAULT_PREFERENCE_DTO: NotificationPreferenceDto = {
  appointmentEmail: true,
  appointmentInApp: true,
  paymentEmail: true,
  paymentInApp: true,
  queueEmail: false,
  queueInApp: true,
  prescriptionEmail: true,
  prescriptionInApp: true,
  announcementEmail: true,
  announcementInApp: true,
};
