'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { ClinicWorkingHoursDto } from '@clinic/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useUpsertWorkingHours } from '@/hooks/clinic/use-clinic-schedule';
import { ApiError } from '@/lib/api-client';
import { Plus, Trash2 } from 'lucide-react';

const WEEKDAY_LABELS: Record<string, string> = { MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday' };

export function WorkingHoursRow({ clinicId, day }: { clinicId: string; day: ClinicWorkingHoursDto }) {
  const [isOpen, setIsOpen] = useState(day.isOpen);
  const [sessions, setSessions] = useState(day.sessions.map((s) => ({ startTime: s.startTime, endTime: s.endTime })));
  const upsert = useUpsertWorkingHours(clinicId);

  function addSession() {
    setSessions((prev) => [...prev, { startTime: '09:00', endTime: '13:00' }]);
  }
  function removeSession(index: number) {
    setSessions((prev) => prev.filter((_, i) => i !== index));
  }
  function updateSession(index: number, key: 'startTime' | 'endTime', value: string) {
    setSessions((prev) => prev.map((s, i) => (i === index ? { ...s, [key]: value } : s)));
  }

  function save(nextIsOpen: boolean, nextSessions: typeof sessions) {
    upsert.mutate(
      { weekday: day.weekday, isOpen: nextIsOpen, sessions: nextSessions },
      { onSuccess: () => toast.success(`${WEEKDAY_LABELS[day.weekday]} updated`), onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update working hours') },
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-center gap-3">
        <Checkbox
          checked={isOpen}
          onCheckedChange={(checked) => {
            const next = Boolean(checked);
            setIsOpen(next);
            save(next, sessions);
          }}
        />
        <span className="w-24 font-medium">{WEEKDAY_LABELS[day.weekday]}</span>
      </div>

      {isOpen && (
        <div className="flex-1 space-y-2">
          {sessions.map((session, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="time"
                value={session.startTime}
                onChange={(e) => updateSession(index, 'startTime', e.target.value)}
                className="border-input bg-background h-8 rounded-md border px-2 text-sm"
              />
              <span className="text-muted-foreground text-sm">to</span>
              <input
                type="time"
                value={session.endTime}
                onChange={(e) => updateSession(index, 'endTime', e.target.value)}
                className="border-input bg-background h-8 rounded-md border px-2 text-sm"
              />
              <Button size="icon" variant="ghost" onClick={() => removeSession(index)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={addSession}>
              <Plus className="size-4" />
              Add session
            </Button>
            <Button size="sm" onClick={() => save(isOpen, sessions)} disabled={upsert.isPending}>
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
