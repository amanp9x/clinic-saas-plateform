'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { NotificationPreferenceDto, NotificationPreferenceInput } from '@clinic/shared';
import {
  useDoctorNotificationPreferences,
  useUpdateDoctorNotificationPreferences,
} from '@/hooks/doctor/use-doctor-notifications';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const CHANNEL_OPTIONS = [
  { value: 'BOTH', label: 'Email & SMS' },
  { value: 'EMAIL', label: 'Email only' },
  { value: 'SMS', label: 'SMS only' },
  { value: 'NONE', label: 'None' },
] as const;

const TOGGLES: { key: keyof Omit<NotificationPreferenceInput, 'channel'>; label: string; description: string }[] = [
  { key: 'appointmentUpdates', label: 'Appointment updates', description: 'New bookings, cancellations, and reminders.' },
  { key: 'queueUpdates', label: 'Queue updates', description: 'Live queue and delay notifications.' },
  { key: 'prescriptionReady', label: 'Prescription reminders', description: 'Reminders about draft prescriptions.' },
  { key: 'reportReady', label: 'System notifications', description: 'Platform and account notices.' },
];

export default function DoctorNotificationSettingsPage() {
  const { data: preferences, isLoading } = useDoctorNotificationPreferences();

  if (isLoading || !preferences) {
    return <Skeleton className="h-80 w-full" />;
  }

  return <NotificationPreferencesForm preferences={preferences} />;
}

function NotificationPreferencesForm({ preferences }: { preferences: NotificationPreferenceDto }) {
  const updatePreferences = useUpdateDoctorNotificationPreferences();
  const [form, setForm] = useState<NotificationPreferenceInput>(preferences);

  const onSave = () => {
    updatePreferences.mutate(form, {
      onSuccess: () => toast.success('Notification preferences updated'),
      onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not save preferences'),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification preferences</CardTitle>
        <CardDescription>Choose what you get notified about and how.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {TOGGLES.map((toggle) => (
          <div key={toggle.key} className="flex items-start gap-3">
            <Checkbox
              id={toggle.key}
              checked={form[toggle.key]}
              onCheckedChange={(checked) => setForm({ ...form, [toggle.key]: checked === true })}
            />
            <div>
              <Label htmlFor={toggle.key} className="font-medium">
                {toggle.label}
              </Label>
              <p className="text-muted-foreground text-sm">{toggle.description}</p>
            </div>
          </div>
        ))}

        <div className="space-y-2 border-t pt-4">
          <Label htmlFor="channel">Delivery channel</Label>
          <Select value={form.channel} onValueChange={(value) => setForm({ ...form, channel: value as NotificationPreferenceInput['channel'] })}>
            <SelectTrigger id="channel" className="w-full sm:w-64">
              <SelectValue placeholder="Select channel" />
            </SelectTrigger>
            <SelectContent>
              {CHANNEL_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={onSave} disabled={updatePreferences.isPending}>
          {updatePreferences.isPending ? 'Saving…' : 'Save preferences'}
        </Button>
      </CardFooter>
    </Card>
  );
}
