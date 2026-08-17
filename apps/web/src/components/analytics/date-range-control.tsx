'use client';

import type { DateRangePreset } from '@clinic/shared';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PRESET_LABELS: Record<DateRangePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last7days: 'Last 7 days',
  last30days: 'Last 30 days',
  thisMonth: 'This month',
  previousMonth: 'Previous month',
  custom: 'Custom range',
};

export function DateRangeControl({
  range,
  from,
  to,
  onChange,
}: {
  range: DateRangePreset;
  from: string;
  to: string;
  onChange: (next: { range: DateRangePreset; from: string; to: string }) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-2">
        <Label htmlFor="analytics-range">Date range</Label>
        <Select value={range} onValueChange={(value) => onChange({ range: value as DateRangePreset, from, to })}>
          <SelectTrigger id="analytics-range" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PRESET_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {range === 'custom' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="analytics-from">From</Label>
            <input
              id="analytics-from"
              type="date"
              value={from}
              onChange={(e) => onChange({ range, from: e.target.value, to })}
              className="border-input bg-background flex h-9 rounded-md border px-3 py-1 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="analytics-to">To</Label>
            <input
              id="analytics-to"
              type="date"
              value={to}
              onChange={(e) => onChange({ range, from, to: e.target.value })}
              className="border-input bg-background flex h-9 rounded-md border px-3 py-1 text-sm"
            />
          </div>
        </>
      )}
    </div>
  );
}
