'use client';

import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { ClinicVerificationStatus } from '@clinic/shared';
import { useUpdateClinicVerification } from '@/hooks/platform-admin/use-platform-admin';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const NOTES_REQUIRED: ClinicVerificationStatus[] = ['REJECTED', 'SUSPENDED'];

export function UpdateVerificationDialog({
  clinicId,
  clinicName,
  targetStatus,
  trigger,
}: {
  clinicId: string;
  clinicName: string;
  targetStatus: ClinicVerificationStatus;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const updateVerification = useUpdateClinicVerification();
  const requiresNotes = NOTES_REQUIRED.includes(targetStatus);

  function submit() {
    if (requiresNotes && !notes.trim()) {
      toast.error('Add a reason before rejecting or suspending a clinic');
      return;
    }
    updateVerification.mutate(
      { id: clinicId, status: targetStatus, notes: notes.trim() || undefined },
      {
        onSuccess: (res) => {
          toast.success(
            res.cancelledAppointmentCount > 0
              ? `${clinicName} moved to ${targetStatus.replace('_', ' ')} — ${res.cancelledAppointmentCount} upcoming appointment${res.cancelledAppointmentCount === 1 ? '' : 's'} cancelled`
              : `${clinicName} moved to ${targetStatus.replace('_', ' ')}`,
          );
          setNotes('');
          setOpen(false);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update verification status'),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{targetStatus.replace('_', ' ')} — {clinicName}</DialogTitle>
          <DialogDescription>
            {requiresNotes ? 'The clinic will see this reason.' : 'This action is logged and the clinic will be notified.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="verification-notes">{requiresNotes ? 'Reason (required)' : 'Notes (optional)'}</Label>
          <Textarea id="verification-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" variant={targetStatus === 'REJECTED' || targetStatus === 'SUSPENDED' ? 'destructive' : 'default'} onClick={submit} disabled={updateVerification.isPending}>
            {updateVerification.isPending ? 'Saving…' : `Confirm ${targetStatus.replace('_', ' ').toLowerCase()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
