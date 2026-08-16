'use client';

import { GenericNotificationList } from '@/components/notifications/generic-notification-list';

export default function ClinicNotificationsPage() {
  return <GenericNotificationList scope="clinic" title="Notifications" description="Billing, staff, and operational updates for your clinic." />;
}
