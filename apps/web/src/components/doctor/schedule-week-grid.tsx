'use client';

import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import type { DoctorScheduleSlotDto } from '@clinic/shared';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/marketing/empty-state';
import { useDeleteScheduleSlot } from '@/hooks/doctor/use-doctor-schedule';
import { ApiError } from '@/lib/api-client';

const WEEKDAY_ORDER = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const WEEKDAY_LABELS: Record<string, string> = {
  MON: 'Monday',
  TUE: 'Tuesday',
  WED: 'Wednesday',
  THU: 'Thursday',
  FRI: 'Friday',
  SAT: 'Saturday',
  SUN: 'Sunday',
};

export function ScheduleWeekGrid({ slots }: { slots: DoctorScheduleSlotDto[] }) {
  const deleteSlot = useDeleteScheduleSlot();

  if (slots.length === 0) {
    return <EmptyState title="No schedule slots yet" description="Add a weekly session to let patients book appointments." />;
  }

  const byWeekday = new Map<string, DoctorScheduleSlotDto[]>();
  for (const slot of slots) {
    byWeekday.set(slot.weekday, [...(byWeekday.get(slot.weekday) ?? []), slot]);
  }

  return (
    <div className="space-y-3">
      {WEEKDAY_ORDER.filter((day) => byWeekday.has(day)).map((day) => (
        <div key={day} className="rounded-lg border p-3">
          <p className="mb-2 text-sm font-semibold">{WEEKDAY_LABELS[day]}</p>
          <div className="space-y-2">
            {byWeekday.get(day)!.map((slot) => (
              <div key={slot.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {slot.startTime}–{slot.endTime} · {slot.consultationDurationMinutes} min slots
                  {slot.breakStartTime ? ` · Break ${slot.breakStartTime}–${slot.breakEndTime}` : ''}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() =>
                    deleteSlot.mutate(slot.id, {
                      onSuccess: () => toast.success('Slot removed'),
                      onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not remove slot'),
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
