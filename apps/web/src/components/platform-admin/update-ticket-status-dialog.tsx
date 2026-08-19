'use client';

import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useUpdateSupportTicketStatus } from '@/hooks/platform-admin/use-platform-support-tickets';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

type TargetStatus = 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export function UpdateTicketStatusDialog({
  ticketId,
  ticketNumber,
  targetStatus,
  trigger,
}: {
  ticketId: string;
  ticketNumber: string;
  targetStatus: TargetStatus;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const updateStatus = useUpdateSupportTicketStatus();
  const requiresNotes = targetStatus === 'RESOLVED';

  function submit() {
    if (requiresNotes && !notes.trim()) {
      toast.error('Add resolution notes before resolving this ticket');
      return;
    }
    updateStatus.mutate(
      { id: ticketId, status: targetStatus, resolutionNotes: notes.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(`${ticketNumber} moved to ${targetStatus.replace('_', ' ')}`);
          setNotes('');
          setOpen(false);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update ticket status'),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {targetStatus.replace('_', ' ')} — {ticketNumber}
          </DialogTitle>
          <DialogDescription>{requiresNotes ? 'The patient will see these resolution notes.' : 'This action is logged and the patient will be notified.'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="ticket-status-notes">{requiresNotes ? 'Resolution notes (required)' : 'Notes (optional)'}</Label>
          <Textarea id="ticket-status-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={updateStatus.isPending}>
            {updateStatus.isPending ? 'Saving…' : `Confirm ${targetStatus.replace('_', ' ').toLowerCase()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
