'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useReceptionPauseQueue } from '@/hooks/reception/use-reception-queue';
import { ApiError } from '@/lib/api-client';
import { Pause } from 'lucide-react';

export function PauseDialog({ clinicId, doctorId }: { clinicId: string; doctorId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const pauseQueue = useReceptionPauseQueue(clinicId, doctorId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button variant="outline">
          <Pause className="size-4" />
          Pause Queue
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pause the queue</DialogTitle>
          <DialogDescription>Waiting patients keep their position — call-next is blocked until you resume.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="pause-reason">Reason (shown to waiting patients)</Label>
          <Textarea id="pause-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. Doctor on a short break" />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() =>
              pauseQueue.mutate(reason, {
                onSuccess: () => {
                  toast.success('Queue paused');
                  setOpen(false);
                  setReason('');
                },
                onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not pause queue'),
              })
            }
            disabled={pauseQueue.isPending}
          >
            {pauseQueue.isPending ? 'Pausing…' : 'Pause Queue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
