'use client';

import { X } from 'lucide-react';
import type { PrescriptionItemInput } from '@clinic/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const FOOD_TIMING_OPTIONS = [
  { value: 'BEFORE_FOOD', label: 'Before food' },
  { value: 'AFTER_FOOD', label: 'After food' },
  { value: 'WITH_FOOD', label: 'With food' },
  { value: 'ANYTIME', label: 'Anytime' },
];

export function PrescriptionItemRow({
  item,
  index,
  onChange,
  onRemove,
}: {
  item: PrescriptionItemInput;
  index: number;
  onChange: (index: number, item: PrescriptionItemInput) => void;
  onRemove: (index: number) => void;
}) {
  function update<K extends keyof PrescriptionItemInput>(key: K, value: PrescriptionItemInput[K]) {
    onChange(index, { ...item, [key]: value });
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Medicine {index + 1}</p>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => onRemove(index)}>
          <X className="size-4" />
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Medicine name</Label>
          <Input value={item.medicineName} onChange={(e) => update('medicineName', e.target.value)} placeholder="e.g. Amoxicillin" />
        </div>
        <div className="space-y-1.5">
          <Label>Dosage</Label>
          <Input value={item.dosage} onChange={(e) => update('dosage', e.target.value)} placeholder="e.g. 500mg" />
        </div>
        <div className="space-y-1.5">
          <Label>Frequency</Label>
          <Input value={item.frequency} onChange={(e) => update('frequency', e.target.value)} placeholder="e.g. Twice daily" />
        </div>
        <div className="space-y-1.5">
          <Label>Duration</Label>
          <Input value={item.duration} onChange={(e) => update('duration', e.target.value)} placeholder="e.g. 5 days" />
        </div>
        <div className="space-y-1.5">
          <Label>Route</Label>
          <Input value={item.route ?? ''} onChange={(e) => update('route', e.target.value)} placeholder="e.g. Oral" />
        </div>
        <div className="space-y-1.5">
          <Label>Before/after food</Label>
          <Select value={item.beforeAfterFood ?? undefined} onValueChange={(v) => update('beforeAfterFood', v as PrescriptionItemInput['beforeAfterFood'])}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {FOOD_TIMING_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Quantity</Label>
          <Input value={item.quantity ?? ''} onChange={(e) => update('quantity', e.target.value)} placeholder="e.g. 10 tablets" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Instructions</Label>
          <Input value={item.instructions ?? ''} onChange={(e) => update('instructions', e.target.value)} placeholder="e.g. Take with warm water" />
        </div>
      </div>
    </div>
  );
}
