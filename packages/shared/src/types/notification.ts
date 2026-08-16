import type { NotificationDeliveryStatus, NotificationPriority, NotificationType } from '../enums.js';

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  actionUrl: string | null;
  priority: NotificationPriority;
  expiresAt: string | null;
  createdAt: string;
}

/** Per-category Email/In-app toggles. TRANSACTIONAL/SECURITY-tier notification types are not
 * represented here at all — they are never suppressible, so there is nothing to toggle. */
export interface NotificationPreferenceDto {
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
}

export interface NotificationDeliveryDto {
  id: string;
  status: NotificationDeliveryStatus;
  attempts: number;
  sentAt: string | null;
  failureReason: string | null;
}
