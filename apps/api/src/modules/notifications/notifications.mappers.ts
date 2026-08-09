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
    createdAt: notification.createdAt.toISOString(),
  };
}

export function toPreferenceDto(pref: NotificationPreference): NotificationPreferenceDto {
  return {
    appointmentUpdates: pref.appointmentUpdates,
    queueUpdates: pref.queueUpdates,
    prescriptionReady: pref.prescriptionReady,
    reportReady: pref.reportReady,
    channel: pref.channel,
  };
}

export const DEFAULT_PREFERENCE_DTO: NotificationPreferenceDto = {
  appointmentUpdates: true,
  queueUpdates: true,
  prescriptionReady: true,
  reportReady: true,
  channel: 'EMAIL',
};
