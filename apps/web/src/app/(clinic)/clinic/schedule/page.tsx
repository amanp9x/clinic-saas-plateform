'use client';

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useSelectedClinic } from '@/hooks/clinic/use-selected-clinic';
import { useClinicWorkingHours } from '@/hooks/clinic/use-clinic-schedule';
import { WorkingHoursRow } from '@/components/clinic/working-hours-row';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';

function ScheduleContent() {
  const router = useRouter();
  const { clinics, clinicId, isLoading: clinicsLoading } = useSelectedClinic();
  const { data: workingHours, isLoading } = useClinicWorkingHours(clinicId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Working Hours</h1>
          <p className="text-muted-foreground text-sm">Weekly schedule with support for multiple sessions per day (e.g. morning + evening).</p>
        </div>
        {clinics.length > 1 && (
          <Select value={clinicId} onValueChange={(value) => value && router.push(`/clinic/schedule?clinicId=${value}`)}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Clinic" />
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
      ) : !clinicId ? (
        <EmptyState title="No clinic associated" description="You are not assigned to any clinic yet." />
      ) : (
        <Card>
          <CardContent className="space-y-3 pt-6">
            {(workingHours ?? []).map((day) => (
              <WorkingHoursRow key={day.weekday} clinicId={clinicId} day={day} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ClinicSchedulePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ScheduleContent />
    </Suspense>
  );
}
