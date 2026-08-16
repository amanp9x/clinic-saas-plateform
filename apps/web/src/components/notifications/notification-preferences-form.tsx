'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { NotificationPreferenceDto, NotificationPreferenceInput } from '@clinic/shared';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

const CATEGORIES: { emailKey: keyof NotificationPreferenceInput; inAppKey: keyof NotificationPreferenceInput; label: string; description: string }[] = [
  { emailKey: 'appointmentEmail', inAppKey: 'appointmentInApp', label: 'Appointments', description: 'Bookings, confirmations, reschedules, cancellations, reminders.' },
  { emailKey: 'paymentEmail', inAppKey: 'paymentInApp', label: 'Payments', description: 'Payment status and refunds.' },
  { emailKey: 'queueEmail', inAppKey: 'queueInApp', label: 'Queue updates', description: 'Check-ins, delays, being called.' },
  { emailKey: 'prescriptionEmail', inAppKey: 'prescriptionInApp', label: 'Prescriptions', description: 'When a new prescription is ready.' },
  { emailKey: 'announcementEmail', inAppKey: 'announcementInApp', label: 'Clinic announcements', description: 'Messages from your clinic.' },
];

export function NotificationPreferencesForm({
  preferences,
  onSave,
}: {
  preferences: NotificationPreferenceDto;
  onSave: (input: NotificationPreferenceInput) => Promise<unknown>;
}) {
  const [form, setForm] = useState<NotificationPreferenceInput>(preferences);
  const [saving, setSaving] = useState(false);

  function toggle(key: keyof NotificationPreferenceInput) {
    setForm((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(form);
      toast.success('Notification preferences updated');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save preferences');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification preferences</CardTitle>
        <CardDescription>Choose whether each category reaches you by email, in-app, or both.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-muted-foreground grid grid-cols-[1fr_auto_auto] gap-4 border-b pb-2 text-xs font-medium uppercase tracking-wide">
          <span>Category</span>
          <span className="text-center">Email</span>
          <span className="text-center">In-app</span>
        </div>
        {CATEGORIES.map((cat) => (
          <div key={cat.label} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b py-3 last:border-b-0">
            <div>
              <p className="text-sm font-medium">{cat.label}</p>
              <p className="text-muted-foreground text-xs">{cat.description}</p>
            </div>
            <Checkbox checked={form[cat.emailKey]} onCheckedChange={() => toggle(cat.emailKey)} aria-label={`${cat.label} email`} />
            <Checkbox checked={form[cat.inAppKey]} onCheckedChange={() => toggle(cat.inAppKey)} aria-label={`${cat.label} in-app`} />
          </div>
        ))}
        <p className="text-muted-foreground pt-3 text-xs">
          Security alerts and critical transactional notifications (payment confirmations, appointment status changes) are always delivered and can&apos;t be turned off here.
        </p>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save preferences'}
        </Button>
      </CardFooter>
    </Card>
  );
}
