'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSelectedClinic } from '@/hooks/reception/use-selected-clinic';
import { useReceptionDoctorStatuses } from '@/hooks/reception/use-reception-doctors';
import { useReceptionQueue, useReceptionQueueLive } from '@/hooks/reception/use-reception-queue';
import { ReceptionQueueConsole } from '@/components/reception/queue-console';
import { EmptyState } from '@/components/marketing/empty-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

function QueuePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clinics, clinicId, isLoading: clinicsLoading } = useSelectedClinic();
  const { data: doctors, isLoading: doctorsLoading } = useReceptionDoctorStatuses(clinicId);
  const doctorId = searchParams.get('doctorId') ?? doctors?.[0]?.doctorId;

  const { data: queue, isLoading: queueLoading } = useReceptionQueue(clinicId, doctorId);
  const { isConnected } = useReceptionQueueLive(clinicId, doctorId);

  function updateParam(key: string, value: string | null) {
    if (!value) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`/reception/queue?${params.toString()}`);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Live Queue Console</h1>
          <p className="text-muted-foreground text-sm">Manually control call-next, delays, priority, and consultation flow.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {clinics.length > 1 && (
            <Select value={clinicId} onValueChange={(value) => updateParam('clinicId', value)}>
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
          {(doctors?.length ?? 0) > 0 && (
            <Select value={doctorId} onValueChange={(value) => updateParam('doctorId', value)}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Doctor" />
              </SelectTrigger>
              <SelectContent>
                {doctors!.map((d) => (
                  <SelectItem key={d.doctorId} value={d.doctorId}>
                    {d.doctorName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {clinicsLoading || doctorsLoading || queueLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !clinicId ? (
        <EmptyState title="No clinic associated" description="You are not assigned to any clinic yet." />
      ) : !doctorId ? (
        <EmptyState title="No doctors at this clinic" description="Doctors associated with this clinic will appear here." />
      ) : queue ? (
        <ReceptionQueueConsole clinicId={clinicId} doctorId={doctorId} queue={queue} isConnected={isConnected} />
      ) : null}
    </div>
  );
}

export default function ReceptionQueuePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <QueuePageContent />
    </Suspense>
  );
}
