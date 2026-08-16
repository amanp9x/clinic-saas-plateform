'use client';

import { GenericNotificationList } from '@/components/notifications/generic-notification-list';

export default function ReceptionNotificationsPage() {
  return <GenericNotificationList scope="reception" title="Notifications" description="New appointments, cancellations, payments, and queue events." />;
}
