'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { Weekday } from '@clinic/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useCreateScheduleSlot } from '@/hooks/doctor/use-doctor-schedule';
import { ApiError } from '@/lib/api-client';

const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: 'MON', label: 'Monday' },
  { value: 'TUE', label: 'Tuesday' },
  { value: 'WED', label: 'Wednesday' },
  { value: 'THU', label: 'Thursday' },
  { value: 'FRI', label: 'Friday' },
  { value: 'SAT', label: 'Saturday' },
  { value: 'SUN', label: 'Sunday' },
];

export function ScheduleSlotDialog({ clinicId, trigger }: { clinicId: string; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [weekday, setWeekday] = useState<Weekday>('MON');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('13:00');
  const [duration, setDuration] = useState('15');
  const [breakStart, setBreakStart] = useState('');
  const [breakEnd, setBreakEnd] = useState('');
  const createSlot = useCreateScheduleSlot();

  function handleSubmit() {
    createSlot.mutate(
      {
        clinicId,
        weekday,
        startTime,
        endTime,
        consultationDurationMinutes: Number(duration),
        breakStartTime: breakStart || undefined,
        breakEndTime: breakEnd || undefined,
        isActive: true,
      },
      {
        onSuccess: () => {
          toast.success('Schedule slot added');
          setOpen(false);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not add schedule slot'),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add schedule slot</DialogTitle>
          <DialogDescription>Add a recurring weekly session for this clinic.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Weekday</Label>
            <Select value={weekday} onValueChange={(v) => setWeekday(v as Weekday)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map((w) => (
                  <SelectItem key={w.value} value={w.value}>
                    {w.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start time</Label>
              <Input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End time</Label>
              <Input id="endTime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="duration">Consultation duration (minutes)</Label>
            <Input id="duration" type="number" min={5} value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="breakStart">Break start (optional)</Label>
              <Input id="breakStart" type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="breakEnd">Break end (optional)</Label>
              <Input id="breakEnd" type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={createSlot.isPending}>
            {createSlot.isPending ? 'Saving…' : 'Add slot'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
