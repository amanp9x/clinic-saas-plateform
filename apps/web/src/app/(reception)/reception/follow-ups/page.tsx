'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClipboardList } from 'lucide-react';
import { useSelectedClinic } from '@/hooks/reception/use-selected-clinic';
import { useReceptionDoctorStatuses } from '@/hooks/reception/use-reception-doctors';
import { useClinicFollowUps } from '@/hooks/reception/use-reception-follow-ups';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';
import { formatDate } from '@/lib/format';

function FollowUpsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clinics, clinicId, isLoading: clinicsLoading } = useSelectedClinic();
  const { data: doctors } = useReceptionDoctorStatuses(clinicId);
  const doctorId = searchParams.get('doctorId') ?? undefined;

  const { data, isLoading } = useClinicFollowUps(clinicId, { doctorId });

  function updateClinic(value: string | null) {
    if (!value) return;
    router.push(`/reception/follow-ups?clinicId=${value}`);
  }

  function updateDoctor(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === 'all') params.delete('doctorId');
    else params.set('doctorId', value);
    router.push(`/reception/follow-ups?${params.toString()}`);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Follow-ups</h1>
          <p className="text-muted-foreground text-sm">Patients due for a recommended follow-up visit.</p>
        </div>
        {clinics.length > 1 && (
          <Select value={clinicId} onValueChange={updateClinic}>
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

      <Select value={doctorId ?? 'all'} onValueChange={updateDoctor}>
        <SelectTrigger className="w-52">
          <SelectValue placeholder="All doctors" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All doctors</SelectItem>
          {(doctors ?? []).map((d) => (
            <SelectItem key={d.doctorId} value={d.doctorId}>
              {d.doctorName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Card>
        <CardContent className="p-0">
          {clinicsLoading || isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !clinicId ? (
            <EmptyState title="No clinic associated" description="You are not assigned to any clinic yet." />
          ) : (data?.items.length ?? 0) === 0 ? (
            <EmptyState icon={ClipboardList} title="No follow-ups due" description="No matching follow-ups for this filter." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Follow-up date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data!.items.map((row) => (
                  <TableRow key={row.consultationId}>
                    <TableCell>
                      <div>{row.patientName}</div>
                      {row.patientPhone && <div className="text-muted-foreground text-xs">{row.patientPhone}</div>}
                    </TableCell>
                    <TableCell>{row.doctorName}</TableCell>
                    <TableCell>{formatDate(row.followUpDate)}</TableCell>
                    <TableCell>
                      <Badge variant={row.isOverdue ? 'destructive' : 'secondary'}>{row.isOverdue ? 'Overdue' : 'Upcoming'}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ReceptionFollowUpsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <FollowUpsContent />
    </Suspense>
  );
}
