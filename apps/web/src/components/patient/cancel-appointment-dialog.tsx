'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { cancelAppointmentSchema, type CancelAppointmentInput } from '@clinic/shared';
import { useCancelAppointment } from '@/hooks/patient/use-appointments';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FormFieldError } from '@/components/auth/form-field-error';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function CancelAppointmentDialog({
  appointmentId,
  trigger,
}: {
  appointmentId: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const cancelAppointment = useCancelAppointment();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CancelAppointmentInput>({ resolver: zodResolver(cancelAppointmentSchema) });

  const onSubmit = handleSubmit((data) => {
    cancelAppointment.mutate(
      { id: appointmentId, ...data },
      {
        onSuccess: () => {
          toast.success('Appointment cancelled');
          reset();
          setOpen(false);
        },
        onError: (err) => {
          toast.error(err instanceof ApiError ? err.message : 'Could not cancel appointment');
        },
      },
    );
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel appointment</DialogTitle>
          <DialogDescription>
            Please tell us why you&apos;re cancelling. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Reason</Label>
            <textarea
              id="cancel-reason"
              rows={4}
              className="shadow-xs focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none"
              placeholder="E.g. schedule conflict, feeling better, etc."
              {...register('reason')}
            />
            <FormFieldError message={errors.reason?.message} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Keep appointment
            </Button>
            <Button type="submit" variant="destructive" disabled={cancelAppointment.isPending}>
              {cancelAppointment.isPending ? 'Cancelling…' : 'Cancel appointment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
