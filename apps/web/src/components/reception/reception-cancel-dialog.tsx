'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { useReceptionCancelAppointment } from '@/hooks/reception/use-reception-booking';
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

export function ReceptionCancelDialog({
  appointmentId,
  clinicId,
  patientName,
  trigger,
}: {
  appointmentId: string;
  clinicId: string;
  patientName: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const cancelAppointment = useReceptionCancelAppointment();

  function submit() {
    if (reason.trim().length < 3) {
      toast.error('Provide a cancellation reason');
      return;
    }
    cancelAppointment.mutate(
      { id: appointmentId, clinicId, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success('Appointment cancelled');
          setReason('');
          setOpen(false);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not cancel appointment'),
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setReason('');
      }}
    >
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel appointment</DialogTitle>
          <DialogDescription>Cancel {patientName}&apos;s appointment. This cannot be undone.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reception-cancel-reason">Reason</Label>
          <Textarea id="reception-cancel-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Keep appointment
          </Button>
          <Button type="button" variant="destructive" onClick={submit} disabled={cancelAppointment.isPending}>
            {cancelAppointment.isPending ? 'Cancelling…' : 'Cancel appointment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
