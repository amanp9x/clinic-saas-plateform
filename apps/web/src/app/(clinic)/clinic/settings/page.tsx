'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { ClinicSettingsDto, PatientDataVisibility } from '@clinic/shared';
import { useSelectedClinic } from '@/hooks/clinic/use-selected-clinic';
import { useClinicSettings, useUpdateClinicSettings } from '@/hooks/clinic/use-clinic-settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';
import { ApiError } from '@/lib/api-client';

/** Keyed by `clinicId` from the parent so React remounts (fresh initial state) whenever the
 * loaded record changes, instead of syncing server data into local state via an effect. */
function SettingsForm({ clinicId, settings }: { clinicId: string; settings: ClinicSettingsDto }) {
  const update = useUpdateClinicSettings(clinicId);

  const [currency, setCurrency] = useState(settings.currency);
  const [defaultDuration, setDefaultDuration] = useState(settings.defaultConsultationDurationMinutes.toString());
  const [bufferMinutes, setBufferMinutes] = useState(settings.bufferMinutes.toString());
  const [cancellationPolicy, setCancellationPolicy] = useState(settings.cancellationPolicy ?? '');
  const [noShowPolicy, setNoShowPolicy] = useState(settings.noShowPolicy ?? '');
  const [appointmentNotifications, setAppointmentNotifications] = useState(settings.appointmentNotificationsEnabled);
  const [queueNotifications, setQueueNotifications] = useState(settings.queueNotificationsEnabled);
  const [delayNotifications, setDelayNotifications] = useState(settings.delayNotificationsEnabled);
  const [reminderMinutes, setReminderMinutes] = useState(settings.reminderMinutesBefore?.toString() ?? '');
  const [patientDataVisibility, setPatientDataVisibility] = useState<PatientDataVisibility>(settings.patientDataVisibility);

  function save() {
    update.mutate(
      {
        currency,
        defaultConsultationDurationMinutes: Number(defaultDuration),
        bufferMinutes: Number(bufferMinutes),
        cancellationPolicy: cancellationPolicy || null,
        noShowPolicy: noShowPolicy || null,
        appointmentNotificationsEnabled: appointmentNotifications,
        queueNotificationsEnabled: queueNotifications,
        delayNotificationsEnabled: delayNotifications,
        reminderMinutesBefore: reminderMinutes ? Number(reminderMinutes) : null,
        patientDataVisibility,
      },
      { onSuccess: () => toast.success('Settings saved'), onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not save settings') },
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <Input id="currency" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appointments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="defaultDuration">Default consultation duration (min)</Label>
              <Input id="defaultDuration" type="number" value={defaultDuration} onChange={(e) => setDefaultDuration(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bufferMinutes">Buffer time (min)</Label>
              <Input id="bufferMinutes" type="number" value={bufferMinutes} onChange={(e) => setBufferMinutes(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cancellationPolicy">Cancellation policy</Label>
            <Textarea id="cancellationPolicy" value={cancellationPolicy} onChange={(e) => setCancellationPolicy(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="noShowPolicy">No-show policy</Label>
            <Textarea id="noShowPolicy" value={noShowPolicy} onChange={(e) => setNoShowPolicy(e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={appointmentNotifications} onCheckedChange={(v) => setAppointmentNotifications(Boolean(v))} />
            Appointment notifications
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={queueNotifications} onCheckedChange={(v) => setQueueNotifications(Boolean(v))} />
            Queue notifications
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={delayNotifications} onCheckedChange={(v) => setDelayNotifications(Boolean(v))} />
            Delay notifications
          </label>
          <div className="space-y-2 pt-2">
            <Label htmlFor="reminderMinutes">Reminder minutes before appointment</Label>
            <Input id="reminderMinutes" type="number" value={reminderMinutes} onChange={(e) => setReminderMinutes(e.target.value)} className="max-w-32" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>Staff patient data visibility</Label>
          <Select value={patientDataVisibility} onValueChange={(v) => v && setPatientDataVisibility(v as PatientDataVisibility)}>
            <SelectTrigger className="max-w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LIMITED">Limited (default)</SelectItem>
              <SelectItem value="FULL">Full</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={update.isPending}>
        {update.isPending ? 'Saving…' : 'Save Settings'}
      </Button>
    </div>
  );
}

function SettingsContent() {
  const router = useRouter();
  const { clinics, clinicId, isLoading: clinicsLoading } = useSelectedClinic();
  const { data: settings, isLoading } = useClinicSettings(clinicId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Clinic Settings</h1>
          <p className="text-muted-foreground text-sm">General, appointment, notification, and privacy settings.</p>
        </div>
        {clinics.length > 1 && (
          <Select value={clinicId} onValueChange={(value) => value && router.push(`/clinic/settings?clinicId=${value}`)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select a clinic" />
            </SelectTrigger>
            <SelectContent>
              {clinics.map((c) => (
                <SelectItem key={c.clinicId} value={c.clinicId}>
                  {c.clinicName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {clinicsLoading || isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !clinicId || !settings ? (
        <EmptyState title="No clinic associated" description="You are not assigned to any clinic yet." />
      ) : (
        <SettingsForm key={clinicId} clinicId={clinicId} settings={settings} />
      )}
    </div>
  );
}

export default function ClinicSettingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <SettingsContent />
    </Suspense>
  );
}
