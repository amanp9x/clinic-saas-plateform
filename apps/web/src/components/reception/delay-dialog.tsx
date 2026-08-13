'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { DELAY_REASON_PRESETS } from '@clinic/shared';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useReceptionUpdateDelay } from '@/hooks/reception/use-reception-queue';
import { ApiError } from '@/lib/api-client';

const QUICK_MINUTES = [5, 10, 15, 20, 30];

export function DelayDialog({ clinicId, doctorId, currentDelayMinutes }: { clinicId: string; doctorId: string; currentDelayMinutes: number | null }) {
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState<number | null>(currentDelayMinutes);
  const [reason, setReason] = useState('');
  const updateDelay = useReceptionUpdateDelay(clinicId, doctorId);

  function submit(nextMinutes: number | null, nextReason: string) {
    if (nextMinutes !== null && !nextReason.trim()) {
      toast.error('A reason is required whenever a delay is set');
      return;
    }
    updateDelay.mutate(
      { delayMinutes: nextMinutes, delayReason: nextReason.trim() || null },
      {
        onSuccess: () => {
          toast.success(nextMinutes === null ? 'Delay cleared' : `Delay set to ${nextMinutes} min`);
          setOpen(false);
          setReason('');
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
          <DialogDescription>Patients waiting for this doctor see this delay reflected in their ETA immediately.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Quick add</Label>
            <div className="flex flex-wrap gap-2">
              {QUICK_MINUTES.map((m) => (
                <Button key={m} type="button" variant={minutes === m ? 'default' : 'outline'} size="sm" onClick={() => setMinutes(m)}>
                  +{m} min
                </Button>
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={() => setMinutes(null)}>
                Clear delay
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="delay-minutes">Custom minutes</Label>
            <input
              id="delay-minutes"
              type="number"
              min={0}
              max={600}
              value={minutes ?? ''}
              onChange={(e) => setMinutes(e.target.value === '' ? null : Number(e.target.value))}
              className="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs"
              placeholder="Leave blank for no delay"
            />
          </div>
          <div className="space-y-2">
            <Label>Reason preset</Label>
            <Select value={reason} onValueChange={(value) => setReason(value ?? '')}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a reason (or type below)" />
              </SelectTrigger>
              <SelectContent>
                {DELAY_REASON_PRESETS.map((preset) => (
                  <SelectItem key={preset} value={preset}>
                    {preset}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="delay-reason">Reason {minutes !== null && <span className="text-destructive">*</span>}</Label>
            <Textarea id="delay-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Required when a delay is set" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => submit(minutes, reason)} disabled={updateDelay.isPending}>
            {updateDelay.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
