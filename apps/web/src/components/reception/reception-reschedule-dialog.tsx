'use client';

import * as React from 'react';
import { toast } from 'sonner';
import type { AvailableSlotDto, ReceptionAppointmentSummaryDto } from '@clinic/shared';
import { useReceptionRescheduleAppointment, useReceptionSlotAvailability } from '@/hooks/reception/use-reception-booking';
import { ApiError } from '@/lib/api-client';
import { DateStrip } from '@/components/booking/date-strip';
import { SlotGrid } from '@/components/booking/slot-grid';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function ReceptionRescheduleDialog({
  appointment,
  trigger,
}: {
  appointment: ReceptionAppointmentSummaryDto;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState(todayIso());
  const [selectedSlot, setSelectedSlot] = React.useState<AvailableSlotDto | null>(null);

  const availability = useReceptionSlotAvailability(appointment.doctorId, appointment.clinicId, date);
  const reschedule = useReceptionRescheduleAppointment();

  function reset() {
    setDate(todayIso());
    setSelectedSlot(null);
  }

  function confirm() {
    if (!selectedSlot) return;
    reschedule.mutate(
      { id: appointment.id, clinicId: appointment.clinicId, newScheduledAt: selectedSlot.startAt },
      {
        onSuccess: () => {
          toast.success('Appointment rescheduled');
          reset();
          setOpen(false);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not reschedule appointment'),
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reschedule appointment</DialogTitle>
          <DialogDescription>Pick a new date and time for {appointment.patientName}.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <DateStrip
            selectedDate={date}
            onSelect={(d) => {
              setDate(d);
              setSelectedSlot(null);
            }}
            days={14}
          />
          {availability.isError ? (
            <p className="text-destructive text-sm">
              {availability.error instanceof ApiError ? availability.error.message : 'Could not load availability'}
            </p>
          ) : (
            <SlotGrid
              slots={availability.data?.slots ?? []}
              closedReason={availability.data?.closedReason ?? null}
              isLoading={availability.isLoading}
              selectedStartAt={selectedSlot?.startAt}
              onSelect={setSelectedSlot}
            />
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={confirm} disabled={!selectedSlot || reschedule.isPending}>
            {reschedule.isPending ? 'Rescheduling…' : 'Confirm new time'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
