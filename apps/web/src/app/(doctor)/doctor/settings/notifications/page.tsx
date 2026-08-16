'use client';

import { useDoctorNotificationPreferences, useUpdateDoctorNotificationPreferences } from '@/hooks/doctor/use-doctor-notifications';
import { NotificationPreferencesForm } from '@/components/notifications/notification-preferences-form';
import { Skeleton } from '@/components/ui/skeleton';

export default function DoctorNotificationSettingsPage() {
  const { data: preferences, isLoading } = useDoctorNotificationPreferences();
  const updatePreferences = useUpdateDoctorNotificationPreferences();

  if (isLoading || !preferences) {
    return <Skeleton className="h-80 w-full" />;
  }

  return <NotificationPreferencesForm preferences={preferences} onSave={(input) => updatePreferences.mutateAsync(input)} />;
}
