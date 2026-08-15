'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { ClinicSettingsDto } from '@clinic/shared';
import { useSelectedClinic } from '@/hooks/clinic/use-selected-clinic';
import { useClinicSettings, useUpdateClinicSettings } from '@/hooks/clinic/use-clinic-settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';
import { ApiError } from '@/lib/api-client';

/** Keyed by `clinicId` from the parent so React remounts (fresh initial state) whenever the
 * loaded record changes, instead of syncing server data into local state via an effect. */
function QueueSettingsForm({ clinicId, settings }: { clinicId: string; settings: ClinicSettingsDto }) {
  const update = useUpdateClinicSettings(clinicId);

  const [queueEnabled, setQueueEnabled] = useState(settings.queueEnabled);
  const [tokenPrefix, setTokenPrefix] = useState(settings.tokenPrefix ?? '');
  const [startingTokenNumber, setStartingTokenNumber] = useState(settings.startingTokenNumber.toString());
  const [dailyTokenReset, setDailyTokenReset] = useState(settings.dailyTokenReset);
  const [priorityQueueEnabled, setPriorityQueueEnabled] = useState(settings.priorityQueueEnabled);
  const [emergencyPriorityEnabled, setEmergencyPriorityEnabled] = useState(settings.emergencyPriorityEnabled);

  function save() {
    update.mutate(
      {
        queueEnabled,
        tokenPrefix: tokenPrefix || null,
        startingTokenNumber: Number(startingTokenNumber),
        dailyTokenReset,
        priorityQueueEnabled,
        emergencyPriorityEnabled,
      },
      { onSuccess: () => toast.success('Queue settings saved'), onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not save queue settings') },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={queueEnabled} onCheckedChange={(v) => setQueueEnabled(Boolean(v))} />
          Queue enabled
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tokenPrefix">Token prefix</Label>
            <Input id="tokenPrefix" value={tokenPrefix} onChange={(e) => setTokenPrefix(e.target.value)} placeholder="e.g. SUN" maxLength={10} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="startingTokenNumber">Starting token number</Label>
            <Input id="startingTokenNumber" type="number" value={startingTokenNumber} onChange={(e) => setStartingTokenNumber(e.target.value)} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={dailyTokenReset} onCheckedChange={(v) => setDailyTokenReset(Boolean(v))} />
          Reset token numbers daily
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={priorityQueueEnabled} onCheckedChange={(v) => setPriorityQueueEnabled(Boolean(v))} />
          Priority queue enabled
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={emergencyPriorityEnabled} onCheckedChange={(v) => setEmergencyPriorityEnabled(Boolean(v))} />
          Emergency priority enabled
        </label>

        <Button onClick={save} disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save Queue Settings'}
        </Button>
      </CardContent>
    </Card>
  );
}

function QueueSettingsContent() {
  const router = useRouter();
  const { clinics, clinicId, isLoading: clinicsLoading } = useSelectedClinic();
  const { data: settings, isLoading } = useClinicSettings(clinicId);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Queue Settings</h1>
          <p className="text-muted-foreground text-sm">Consumed by the existing queue engine — the queue engine remains the source of truth for behavior.</p>
        </div>
        {clinics.length > 1 && (
          <Select value={clinicId} onValueChange={(value) => value && router.push(`/clinic/queue-settings?clinicId=${value}`)}>
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
        <QueueSettingsForm key={clinicId} clinicId={clinicId} settings={settings} />
      )}
    </div>
  );
}

export default function ClinicQueueSettingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <QueueSettingsContent />
    </Suspense>
  );
}
