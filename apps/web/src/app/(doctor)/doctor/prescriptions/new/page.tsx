'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PrescriptionBuilder } from '@/components/doctor/prescription-builder';
import { EmptyState } from '@/components/marketing/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

function NewPrescriptionContent() {
  const searchParams = useSearchParams();
  const patientId = searchParams.get('patientId');
  const appointmentId = searchParams.get('appointmentId') ?? undefined;

  if (!patientId) {
    return (
      <EmptyState
        title="No patient selected"
        description="Start a prescription from an appointment or patient profile."
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">New Prescription</h1>
        <p className="text-muted-foreground text-sm">Build a structured prescription for this patient.</p>
      </div>
      <PrescriptionBuilder patientId={patientId} appointmentId={appointmentId} />
    </div>
  );
}

export default function NewPrescriptionPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <NewPrescriptionContent />
    </Suspense>
  );
}
