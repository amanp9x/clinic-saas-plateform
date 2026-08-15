'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { StaffInviteInput } from '@clinic/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useInviteStaff } from '@/hooks/clinic/use-clinic-staff';
import { ApiError } from '@/lib/api-client';

type StaffRole = StaffInviteInput['role'];
const STAFF_ROLES: StaffRole[] = ['RECEPTIONIST', 'CLINIC_STAFF', 'CLINIC_ADMIN'];

export function InviteStaffDialog({ clinicId, defaultOpen }: { clinicId: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('RECEPTIONIST');
  const [title, setTitle] = useState('');
  const invite = useInviteStaff(clinicId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button>Invite Staff</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a staff member</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-title">Title (optional)</Label>
            <Input id="invite-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Front Desk Receptionist" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!email.trim() || invite.isPending}
            onClick={() =>
              invite.mutate(
                { email, role, title: title || undefined, permissions: [] },
                {
                  onSuccess: () => {
                    toast.success('Invitation sent');
                    setOpen(false);
                    setEmail('');
                    setTitle('');
                  },
                  onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not send invitation'),
                },
              )
            }
          >
            {invite.isPending ? 'Sending…' : 'Send Invitation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
