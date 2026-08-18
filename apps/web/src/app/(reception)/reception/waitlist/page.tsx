'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Clock } from 'lucide-react';
import type { WaitlistStatusValue } from '@clinic/shared';
import { useSelectedClinic } from '@/hooks/reception/use-selected-clinic';
import { useReceptionDoctorStatuses } from '@/hooks/reception/use-reception-doctors';
import { useCancelClinicWaitlistEntry, useClinicWaitlist } from '@/hooks/reception/use-reception-waitlist';
import { AddToWaitlistDialog } from '@/components/reception/add-to-waitlist-dialog';
import { ApiError } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';

const STATUS_OPTIONS: WaitlistStatusValue[] = ['ACTIVE', 'NOTIFIED', 'FULFILLED', 'CANCELLED'];

function WaitlistContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clinics, clinicId, isLoading: clinicsLoading } = useSelectedClinic();
  const { data: doctors } = useReceptionDoctorStatuses(clinicId);
  const doctorId = searchParams.get('doctorId') ?? undefined;
  const [status, setStatus] = useState<WaitlistStatusValue | ''>('');

  const { data, isLoading } = useClinicWaitlist(clinicId, { doctorId, status: status || undefined });
  const cancelEntry = useCancelClinicWaitlistEntry();

  function updateClinic(value: string | null) {
    if (!value) return;
    router.push(`/reception/waitlist?clinicId=${value}`);
  }

  function updateDoctor(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === 'all') params.delete('doctorId');
    else params.set('doctorId', value);
    router.push(`/reception/waitlist?${params.toString()}`);
  }

  function handleCancel(id: string) {
    if (!clinicId) return;
    cancelEntry.mutate(
      { id, clinicId },
      {
        onSuccess: () => toast.success('Removed from waitlist'),
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not remove from waitlist'),
      },
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Waitlist</h1>
          <p className="text-muted-foreground text-sm">Patients waiting for an opening with a fully-booked doctor.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {clinicId && <AddToWaitlistDialog clinicId={clinicId} trigger={<Button size="sm">Add to waitlist</Button>} />}
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
      </div>

      <div className="flex flex-wrap gap-2">
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
        <Select value={status || 'all'} onValueChange={(v) => setStatus(v === 'all' ? '' : ((v ?? '') as WaitlistStatusValue))}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {clinicsLoading || isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !clinicId ? (
            <EmptyState title="No clinic associated" description="You are not assigned to any clinic yet." />
          ) : (data?.items.length ?? 0) === 0 ? (
            <EmptyState icon={Clock} title="No one waiting" description="No matching waitlist entries for this filter." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data!.items.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div>{entry.patientName}</div>
                      {entry.patientPhone && <div className="text-muted-foreground text-xs">{entry.patientPhone}</div>}
                    </TableCell>
                    <TableCell>{entry.doctorName}</TableCell>
                    <TableCell>{formatDate(`${entry.targetDate}T00:00:00.000Z`)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{entry.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{formatDate(entry.createdAt)}</TableCell>
                    <TableCell>
                      {(entry.status === 'ACTIVE' || entry.status === 'NOTIFIED') && (
                        <Button size="sm" variant="outline" onClick={() => handleCancel(entry.id)} disabled={cancelEntry.isPending}>
                          Remove
                        </Button>
                      )}
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

export default function ReceptionWaitlistPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <WaitlistContent />
    </Suspense>
  );
}
