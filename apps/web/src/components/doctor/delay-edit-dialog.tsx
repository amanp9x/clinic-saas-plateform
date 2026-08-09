'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { QueueSnapshotDto } from '@clinic/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { useUpdateQueueDelay } from '@/hooks/doctor/use-doctor-queue';
import { ApiError } from '@/lib/api-client';

export function DelayEditDialog({ clinicId, session }: { clinicId: string; session: QueueSnapshotDto['session'] }) {
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(session?.delayMinutes?.toString() ?? '');
  const [reason, setReason] = useState(session?.delayReason ?? '');
  const updateDelay = useUpdateQueueDelay(clinicId);

  function handleSubmit() {
    const delayMinutes = minutes.trim() === '' ? null : Number(minutes);
    updateDelay.mutate(
      { delayMinutes, delayReason: reason.trim() === '' ? null : reason.trim() },
      {
        onSuccess: () => {
          toast.success('Delay updated');
          setOpen(false);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update delay'),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          Update delay
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update queue delay</DialogTitle>
          <DialogDescription>
            Your clinic permissions allow you to override the receptionist&apos;s delay update for this queue.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="delayMinutes">Delay (minutes)</Label>
            <Input
              id="delayMinutes"
              type="number"
              min={0}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="Leave blank to clear"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="delayReason">Reason</Label>
            <Textarea id="delayReason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={updateDelay.isPending}>
            {updateDelay.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
