'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useSelectedClinic } from '@/hooks/clinic/use-selected-clinic';
import { useClinicDoctors, useUpdateClinicDoctorStatus } from '@/hooks/clinic/use-clinic-doctors';
import { AssociateDoctorDialog } from '@/components/clinic/associate-doctor-dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';
import { ApiError } from '@/lib/api-client';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = { ACTIVE: 'default', INACTIVE: 'secondary', SUSPENDED: 'destructive' };

function DoctorsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clinics, clinicId, isLoading: clinicsLoading } = useSelectedClinic();
  const [q, setQ] = useState('');
  const { data, isLoading } = useClinicDoctors(clinicId, q);
  const updateStatus = useUpdateClinicDoctorStatus(clinicId);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Doctors</h1>
          <p className="text-muted-foreground text-sm">Doctors associated with this clinic and their queue configuration.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {clinics.length > 1 && (
            <Select value={clinicId} onValueChange={(value) => value && router.push(`/clinic/doctors?clinicId=${value}`)}>
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
          {clinicId && <AssociateDoctorDialog clinicId={clinicId} defaultOpen={searchParams.get('invite') === '1'} />}
        </div>
      </div>

      {clinicsLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !clinicId ? (
        <EmptyState title="No clinic associated" description="You are not assigned to any clinic yet." />
      ) : (
        <div className="space-y-4">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search doctors by name" className="max-w-sm" />
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (data?.items.length ?? 0) === 0 ? (
                <EmptyState title="No doctors" description="Associate an existing doctor with this clinic to get started." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Specialization</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Fee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data!.items.map((d) => (
                      <TableRow key={d.clinicDoctorId}>
                        <TableCell>
                          <Link href={`/clinic/doctors/${d.clinicDoctorId}?clinicId=${clinicId}`} className="font-medium hover:underline">
                            {d.doctorName}
                          </Link>
                        </TableCell>
                        <TableCell>{d.specializationName ?? '—'}</TableCell>
                        <TableCell>{d.departmentName ?? '—'}</TableCell>
                        <TableCell>{d.consultationFee ? `₹${d.consultationFee}` : '—'}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[d.status]}>{d.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Select
                            value={d.status}
                            onValueChange={(status) =>
                              status &&
                              updateStatus.mutate(
                                { clinicDoctorId: d.clinicDoctorId, status: status as never },
                                {
                                  onSuccess: (res) =>
                                    toast.success(
                                      res.cancelledAppointmentCount > 0
                                        ? `Status updated — ${res.cancelledAppointmentCount} upcoming appointment${res.cancelledAppointmentCount === 1 ? '' : 's'} cancelled`
                                        : 'Status updated',
                                    ),
                                  onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update status'),
                                },
                              )
                            }
                          >
                            <SelectTrigger className="ml-auto h-8 w-32 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ACTIVE">Active</SelectItem>
                              <SelectItem value="INACTIVE">Inactive</SelectItem>
                              <SelectItem value="SUSPENDED">Suspended</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function ClinicDoctorsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <DoctorsContent />
    </Suspense>
  );
}
