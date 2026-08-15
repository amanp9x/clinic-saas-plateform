'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useSelectedClinic } from '@/hooks/clinic/use-selected-clinic';
import { useClinicStaff, useClinicStaffInvitations, useRevokeInvitation, useSetStaffActive } from '@/hooks/clinic/use-clinic-staff';
import { InviteStaffDialog } from '@/components/clinic/invite-staff-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';
import { ApiError } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';

function StaffContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clinics, clinicId, isLoading: clinicsLoading } = useSelectedClinic();
  const [q, setQ] = useState('');
  const { data, isLoading } = useClinicStaff(clinicId, q);
  const { data: invitations } = useClinicStaffInvitations(clinicId);
  const setActive = useSetStaffActive(clinicId);
  const revokeInvitation = useRevokeInvitation(clinicId);

  const pendingInvitations = (invitations ?? []).filter((i) => i.status === 'PENDING');

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Staff</h1>
          <p className="text-muted-foreground text-sm">Receptionists, clinic staff, and clinic admins at this clinic.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {clinics.length > 1 && (
            <Select value={clinicId} onValueChange={(value) => value && router.push(`/clinic/staff?clinicId=${value}`)}>
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
          {clinicId && <InviteStaffDialog clinicId={clinicId} defaultOpen={searchParams.get('invite') === '1'} />}
        </div>
      </div>

      {clinicsLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !clinicId ? (
        <EmptyState title="No clinic associated" description="You are not assigned to any clinic yet." />
      ) : (
        <div className="space-y-6">
          {pendingInvitations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pending Invitations</CardTitle>
              </CardHeader>
              <CardContent className="divide-y">
                {pendingInvitations.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <p className="font-medium">{inv.email}</p>
                      <p className="text-muted-foreground text-xs">
                        {inv.role.replace('_', ' ')} · Expires {formatDateTime(inv.expiresAt)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        revokeInvitation.mutate(inv.id, {
                          onSuccess: () => toast.success('Invitation revoked'),
                          onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not revoke invitation'),
                        })
                      }
                    >
                      Revoke
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by email or phone" className="max-w-sm" />

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (data?.items.length ?? 0) === 0 ? (
                <EmptyState title="No staff yet" description="Invite your first staff member to get started." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data!.items.map((s) => (
                      <TableRow key={s.staffMemberId}>
                        <TableCell>
                          <Link href={`/clinic/staff/${s.staffMemberId}?clinicId=${clinicId}`} className="font-medium hover:underline">
                            {s.fullName ?? s.email ?? s.phone ?? 'Unnamed'}
                          </Link>
                          {s.title && <p className="text-muted-foreground text-xs">{s.title}</p>}
                        </TableCell>
                        <TableCell>{s.email ?? '—'}</TableCell>
                        <TableCell>{s.role.replace('_', ' ')}</TableCell>
                        <TableCell>
                          <Badge variant={s.isActive ? 'default' : 'secondary'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{s.lastActiveAt ? formatDateTime(s.lastActiveAt) : 'Never'}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setActive.mutate(
                                { staffMemberId: s.staffMemberId, active: !s.isActive },
                                { onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update status') },
                              )
                            }
                          >
                            {s.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
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

export default function ClinicStaffPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <StaffContent />
    </Suspense>
  );
}
