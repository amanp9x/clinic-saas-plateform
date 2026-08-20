'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { useCollectCounterPayment } from '@/hooks/reception/use-reception-booking';
import { ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

const METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'UPI', label: 'UPI' },
  { value: 'OTHER', label: 'Other' },
] as const;

export function CollectPaymentDialog({
  appointmentId,
  patientName,
  trigger,
}: {
  appointmentId: string;
  patientName: string;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [method, setMethod] = React.useState<(typeof METHODS)[number]['value']>('CASH');
  const [notes, setNotes] = React.useState('');
  const collect = useCollectCounterPayment();

  function submit() {
    collect.mutate(
      { appointmentId, method, notes: notes.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Payment recorded');
          setNotes('');
          setOpen(false);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not record payment'),
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setNotes('');
      }}
    >
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Collect payment</DialogTitle>
          <DialogDescription>Record what {patientName} paid at the desk. The amount is calculated automatically.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="collect-payment-method">Method</Label>
            <Select value={method} onValueChange={(v) => v && setMethod(v as (typeof METHODS)[number]['value'])}>
              <SelectTrigger id="collect-payment-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="collect-payment-notes">Notes (optional)</Label>
            <Textarea id="collect-payment-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={collect.isPending}>
            {collect.isPending ? 'Recording…' : 'Record payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
