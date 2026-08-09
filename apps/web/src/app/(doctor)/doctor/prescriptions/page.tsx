'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FileText } from 'lucide-react';
import { usePrescriptions } from '@/hooks/doctor/use-prescriptions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/marketing/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/format';

function PrescriptionsListContent() {
  const searchParams = useSearchParams();
  const patientId = searchParams.get('patientId') ?? undefined;
  const appointmentId = searchParams.get('appointmentId') ?? undefined;
  const { data, isLoading } = usePrescriptions({ patientId, appointmentId });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Prescriptions</h1>
          <p className="text-muted-foreground text-sm">Drafts and finalized prescriptions you&apos;ve issued.</p>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={FileText} title="No prescriptions yet" description="Prescriptions you create from a consultation will appear here." />
      ) : (
        <div className="space-y-3">
          {data.items.map((rx) => (
            <Card key={rx.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{rx.patientName}</p>
                  <p className="text-muted-foreground text-sm">
                    {formatDate(rx.issuedAt)} · {rx.items.length} medicine{rx.items.length === 1 ? '' : 's'}
                    {rx.diagnosis ? ` · ${rx.diagnosis}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={rx.status === 'FINALIZED' ? 'secondary' : 'outline'}>{rx.status}</Badge>
                  <Button size="sm" variant="outline" render={<Link href={`/doctor/prescriptions/${rx.id}`} />}>
                    {rx.status === 'DRAFT' ? 'Edit' : 'View'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PrescriptionsListPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <PrescriptionsListContent />
    </Suspense>
  );
}
