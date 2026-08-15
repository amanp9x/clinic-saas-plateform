'use client';

import { Suspense, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ALL_CLINIC_PERMISSIONS, type ClinicStaffSummaryDto, type StaffRoleUpdateInput } from '@clinic/shared';
import { useSelectedClinic } from '@/hooks/clinic/use-selected-clinic';
import { useClinicStaffMember, useRevokeStaffAccess, useUpdateStaffPermissions, useUpdateStaffRole } from '@/hooks/clinic/use-clinic-staff';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';
import { ApiError } from '@/lib/api-client';
import { initials } from '@/lib/format';

type StaffRole = StaffRoleUpdateInput['role'];
const STAFF_ROLES: StaffRole[] = ['RECEPTIONIST', 'CLINIC_STAFF', 'CLINIC_ADMIN'];

/** Keyed by `staffMember.staffMemberId` from the parent so React remounts (fresh initial state)
 * whenever the loaded record changes, instead of syncing server data into local state via an effect. */
function StaffMemberForm({ clinicId, staffMember }: { clinicId: string; staffMember: ClinicStaffSummaryDto }) {
  const router = useRouter();
  const updateRole = useUpdateStaffRole(clinicId);
  const updatePermissions = useUpdateStaffPermissions(clinicId);
  const revokeAccess = useRevokeStaffAccess(clinicId);

  // Clinic staff always carry one of the three staff roles, enforced server-side.
  const [role, setRole] = useState<StaffRole>(staffMember.role as StaffRole);
  const [title, setTitle] = useState(staffMember.title ?? '');
  const [permissions, setPermissions] = useState<string[]>(staffMember.permissions);
  const [revokeOpen, setRevokeOpen] = useState(false);

  function togglePermission(permission: string) {
    setPermissions((prev) => (prev.includes(permission) ? prev.filter((p) => p !== permission) : [...prev, permission]));
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center gap-4">
          <Avatar className="size-14">
            <AvatarFallback>{initials(staffMember.fullName ?? staffMember.email ?? '?')}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-xl">{staffMember.fullName ?? staffMember.email ?? 'Unnamed'}</CardTitle>
            <p className="text-muted-foreground text-sm">{staffMember.email ?? staffMember.phone ?? '—'}</p>
          </div>
          <Badge className="ml-auto" variant={staffMember.isActive ? 'default' : 'secondary'}>
            {staffMember.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Role</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => v && setRole(v as StaffRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAFF_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">Role changes apply to this person&apos;s account across every clinic they staff.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-title">Title</Label>
              <Input id="staff-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
          </div>
          <Button
            onClick={() =>
              updateRole.mutate(
                { staffMemberId: staffMember.staffMemberId, input: { role, title: title || null } },
                { onSuccess: () => toast.success('Role updated'), onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update role') },
              )
            }
            disabled={updateRole.isPending}
          >
            Save Role
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permissions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">CLINIC_ADMIN bypasses these entirely. For other roles, only listed permissions are granted.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {ALL_CLINIC_PERMISSIONS.map((permission) => (
              <label key={permission} className="flex items-center gap-2 text-sm">
                <Checkbox checked={permissions.includes(permission)} onCheckedChange={() => togglePermission(permission)} />
                {permission}
              </label>
            ))}
          </div>
          <Button
            onClick={() =>
              updatePermissions.mutate(
                { staffMemberId: staffMember.staffMemberId, input: { permissions } },
                { onSuccess: () => toast.success('Permissions updated'), onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update permissions') },
              )
            }
            disabled={updatePermissions.isPending}
          >
            Save Permissions
          </Button>
        </CardContent>
      </Card>

      <Dialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <DialogTrigger>
          <Button variant="destructive">Revoke Access</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke this person&apos;s access to the clinic?</DialogTitle>
            <DialogDescription>They will no longer be able to sign in to this clinic&apos;s Reception or Clinic Management portals.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                revokeAccess.mutate(staffMember.staffMemberId, {
                  onSuccess: () => {
                    toast.success('Access revoked');
                    router.push(`/clinic/staff?clinicId=${clinicId}`);
                  },
                  onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not revoke access'),
                })
              }
              disabled={revokeAccess.isPending}
            >
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StaffDetailContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { clinicId: fallbackClinicId } = useSelectedClinic();
  const clinicId = searchParams.get('clinicId') ?? fallbackClinicId;

  const { data: staffMember, isLoading } = useClinicStaffMember(clinicId, params.id);

  if (isLoading) return <Skeleton className="mx-auto h-96 max-w-2xl" />;
  if (!staffMember || !clinicId) return <EmptyState title="Staff member not found" description="This staff member is not part of the selected clinic." />;

  return (
    <div className="mx-auto max-w-2xl">
      <StaffMemberForm key={staffMember.staffMemberId} clinicId={clinicId} staffMember={staffMember} />
    </div>
  );
}

export default function ClinicStaffDetailPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 max-w-2xl" />}>
      <StaffDetailContent />
    </Suspense>
  );
}
