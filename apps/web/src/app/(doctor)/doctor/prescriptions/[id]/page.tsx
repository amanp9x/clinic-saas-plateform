'use client';

import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PrescriptionBuilder } from '@/components/doctor/prescription-builder';
import { usePrescriptionDetail } from '@/hooks/doctor/use-prescriptions';

export default function PrescriptionDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: prescription, isLoading } = usePrescriptionDetail(params.id);

  if (isLoading || !prescription) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Prescription — {prescription.patientName}</h1>
          <p className="text-muted-foreground text-sm">Issued {new Date(prescription.issuedAt).toLocaleDateString('en-IN')}</p>
        </div>
        <Badge variant={prescription.status === 'FINALIZED' ? 'secondary' : 'outline'}>{prescription.status}</Badge>
      </div>
      <PrescriptionBuilder patientId={prescription.patientId} appointmentId={prescription.appointmentId ?? undefined} existing={prescription} />
    </div>
  );
}
