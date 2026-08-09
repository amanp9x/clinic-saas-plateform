'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDoctorClinics } from '@/hooks/doctor/use-doctor-clinics';
import { useDoctorQueue, useDoctorQueueLive } from '@/hooks/doctor/use-doctor-queue';
import { QueueConsole } from '@/components/doctor/queue-console';
import { EmptyState } from '@/components/marketing/empty-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

function QueuePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: clinics, isLoading: clinicsLoading } = useDoctorClinics();
  const activeClinics = (clinics ?? []).filter((c) => c.isActive);
  const clinicId = searchParams.get('clinicId') ?? activeClinics[0]?.clinicId;

  const { data: queue, isLoading: queueLoading } = useDoctorQueue(clinicId);
  const { isConnected } = useDoctorQueueLive(clinicId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Live Queue</h1>
          <p className="text-muted-foreground text-sm">Manage today&apos;s clinic session and patient flow in real time.</p>
        </div>
        {activeClinics.length > 1 && (
          <Select value={clinicId} onValueChange={(value) => router.push(`/doctor/queue?clinicId=${value}`)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select a clinic" />
            </SelectTrigger>
            <SelectContent>
              {activeClinics.map((clinic) => (
                <SelectItem key={clinic.clinicId} value={clinic.clinicId}>
                  {clinic.clinicName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {clinicsLoading || queueLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !clinicId ? (
        <EmptyState title="No clinic associated" description="Associate with a clinic to start managing a live queue." />
      ) : queue ? (
        <QueueConsole clinicId={clinicId} queue={queue} isConnected={isConnected} />
      ) : null}
    </div>
  );
}

export default function QueuePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <QueuePageContent />
    </Suspense>
  );
}
