'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useSelectedClinic } from '@/hooks/reception/use-selected-clinic';
import { useReceptionPatientQuickView } from '@/hooks/reception/use-reception-patients';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';
import { formatDateTime } from '@/lib/format';
import { initials } from '@/lib/format';

function PatientQuickViewContent() {
  const params = useParams<{ patientId: string }>();
  const searchParams = useSearchParams();
  const { clinicId: fallbackClinicId } = useSelectedClinic();
  const clinicId = searchParams.get('clinicId') ?? fallbackClinicId;

  const { data: patient, isLoading } = useReceptionPatientQuickView(clinicId, params.patientId);

  if (isLoading) return <Skeleton className="mx-auto h-96 max-w-xl" />;
  if (!patient) return <EmptyState title="Patient not found" description="This patient has no relationship with the selected clinic." />;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Card>
        <CardHeader className="flex-row items-center gap-4">
          <Avatar className="size-14">
            <AvatarFallback>{initials(patient.fullName)}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-xl">{patient.fullName}</CardTitle>
            <p className="text-muted-foreground text-sm">
              {patient.age !== null ? `${patient.age} years` : 'Age unknown'} {patient.gender ? `· ${patient.gender}` : ''}
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Phone:</span> {patient.phone ?? '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Email:</span> {patient.email ?? '—'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Appointment</CardTitle>
        </CardHeader>
        <CardContent>
          {patient.todayAppointment ? (
            <div className="space-y-2 text-sm">
              <p className="font-medium">{patient.todayAppointment.doctorName}</p>
              <p className="text-muted-foreground">{formatDateTime(patient.todayAppointment.scheduledAt)}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{patient.todayAppointment.status.replace('_', ' ')}</Badge>
                {patient.todayAppointment.tokenNumber && <Badge variant="secondary">Token #{patient.todayAppointment.tokenNumber}</Badge>}
              </div>
            </div>
          ) : (
            <EmptyState title="No appointment today" description="This patient has no appointment scheduled today at this clinic." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ReceptionPatientQuickViewPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 max-w-xl" />}>
      <PatientQuickViewContent />
    </Suspense>
  );
}
