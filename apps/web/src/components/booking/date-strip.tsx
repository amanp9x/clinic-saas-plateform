'use client';

import { cn } from '@/lib/utils';

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function nextDays(count: number): Date[] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export function DateStrip({
  selectedDate,
  onSelect,
  days = 21,
}: {
  selectedDate: string;
  onSelect: (date: string) => void;
  days?: number;
}) {
  const dates = nextDays(days);

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {dates.map((d) => {
        const iso = toIsoDate(d);
        const isSelected = iso === selectedDate;
        return (
          <button
            key={iso}
            type="button"
            onClick={() => onSelect(iso)}
            className={cn(
              'flex shrink-0 flex-col items-center rounded-lg border px-3 py-2 text-sm transition-colors',
              isSelected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'hover:bg-muted border-input bg-transparent',
            )}
          >
            <span className="text-xs opacity-80">{d.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
            <span className="font-medium">{d.getDate()}</span>
            <span className="text-[10px] opacity-70">{d.toLocaleDateString('en-IN', { month: 'short' })}</span>
          </button>
        );
      })}
    </div>
  );
}
