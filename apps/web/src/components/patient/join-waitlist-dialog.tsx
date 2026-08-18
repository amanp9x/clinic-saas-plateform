'use client';

import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { ConsultationType } from '@clinic/shared';
import { useJoinWaitlist } from '@/hooks/patient/use-waitlist';
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
import { formatDate } from '@/lib/format';

export function JoinWaitlistDialog({
  doctorId,
  clinicId,
  doctorName,
  targetDate,
  consultationType,
  trigger,
}: {
  doctorId: string;
  clinicId: string;
  doctorName: string;
  targetDate: string;
  consultationType: ConsultationType;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const joinWaitlist = useJoinWaitlist();

  function submit() {
    joinWaitlist.mutate(
      { doctorId, clinicId, targetDate, consultationType, notes: notes.trim() || undefined },
      {
        onSuccess: () => {
          toast.success("You're on the waitlist — we'll notify you if a slot opens up");
          setNotes('');
          setOpen(false);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not join the waitlist'),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join the waitlist</DialogTitle>
          <DialogDescription>
            We&apos;ll notify you the moment a slot opens up with {doctorName} on {formatDate(`${targetDate}T00:00:00.000Z`)}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="waitlist-notes">Notes (optional)</Label>
          <Textarea id="waitlist-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything reception should know…" />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={joinWaitlist.isPending}>
            {joinWaitlist.isPending ? 'Joining…' : 'Join waitlist'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
