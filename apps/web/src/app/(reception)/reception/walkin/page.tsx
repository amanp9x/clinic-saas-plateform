'use client';

import { Suspense } from 'react';
import { useSelectedClinic } from '@/hooks/reception/use-selected-clinic';
import { WalkInForm } from '@/components/reception/walkin-form';
import { EmptyState } from '@/components/marketing/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

function WalkInContent() {
  const { clinicId, isLoading } = useSelectedClinic();

  if (isLoading) return <Skeleton className="mx-auto h-96 max-w-2xl" />;
  if (!clinicId) return <EmptyState title="No clinic associated" description="You are not assigned to any clinic yet." />;

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-heading text-2xl font-semibold">Walk-in Registration</h1>
        <p className="text-muted-foreground text-sm">Register a walk-in patient and add them straight to the live queue.</p>
      </div>
      <WalkInForm clinicId={clinicId} />
    </div>
  );
}

export default function ReceptionWalkInPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 max-w-2xl" />}>
      <WalkInContent />
    </Suspense>
  );
}
