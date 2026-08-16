'use client';

import { useNotificationPreferences, useUpdateNotificationPreferences } from '@/hooks/patient/use-notifications';
import { NotificationPreferencesForm } from '@/components/notifications/notification-preferences-form';
import { Skeleton } from '@/components/ui/skeleton';

export default function NotificationSettingsPage() {
  const { data: preferences, isLoading } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();

  if (isLoading || !preferences) {
    return <Skeleton className="h-80 w-full" />;
  }

  return <NotificationPreferencesForm preferences={preferences} onSave={(input) => updatePreferences.mutateAsync(input)} />;
}
