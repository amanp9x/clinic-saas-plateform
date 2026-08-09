'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { ClinicAssociationDto } from '@clinic/shared';
import { useDoctorClinics, useUpdateClinicAssociation } from '@/hooks/doctor/use-doctor-clinics';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/marketing/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api-client';

function ClinicRow({ clinic }: { clinic: ClinicAssociationDto }) {
  const [fee, setFee] = useState(clinic.consultationFeeOverride ?? '');
  const [duration, setDuration] = useState(clinic.consultationDurationMinutesOverride?.toString() ?? '');
  const updateClinic = useUpdateClinicAssociation();

  function handleSave() {
    updateClinic.mutate(
      {
        clinicId: clinic.clinicId,
        consultationFeeOverride: fee === '' ? null : Number(fee),
        consultationDurationMinutesOverride: duration === '' ? null : Number(duration),
      },
      {
        onSuccess: () => toast.success('Clinic settings updated'),
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update settings'),
      },
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{clinic.clinicName}</CardTitle>
        {clinic.canOverrideDelay && <Badge variant="secondary">Delay override authorized</Badge>}
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">{clinic.city ?? 'Location not set'}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Consultation fee override (₹)</Label>
            <Input type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} placeholder="Use default fee" />
          </div>
          <div className="space-y-2">
            <Label>Consultation duration override (min)</Label>
            <Input type="number" min={5} value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Use schedule default" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={updateClinic.isPending}>
            {updateClinic.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DoctorClinicsSettingsPage() {
  const { data: clinics, isLoading } = useDoctorClinics();

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!clinics || clinics.length === 0) {
    return <EmptyState title="No clinic associations" description="You'll see your clinics here once associated." />;
  }

  return (
    <div className="space-y-4">
      {clinics.map((clinic) => (
        <ClinicRow key={clinic.clinicId} clinic={clinic} />
      ))}
    </div>
  );
}
