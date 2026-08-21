'use client';

import type { AvailableSlotDto, SlotClosedReason } from '@clinic/shared';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/marketing/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

const CLOSED_REASON_LABELS: Record<SlotClosedReason, string> = {
  DOCTOR_NOT_ACCEPTING: 'This doctor is not accepting appointments at this clinic right now.',
  CLINIC_CLOSED: 'The clinic is closed on this day.',
  CLINIC_HOLIDAY: 'The clinic is closed for a holiday on this day.',
  DOCTOR_ON_LEAVE: 'The doctor is on leave on this day.',
  NO_SESSIONS_TODAY: 'The doctor has no sessions scheduled on this day.',
  CLINIC_SUSPENDED: 'This clinic is temporarily not accepting bookings.',
};

function formatSlotTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export function SlotGrid({
  slots,
  closedReason,
  isLoading,
  selectedStartAt,
  onSelect,
}: {
  slots: AvailableSlotDto[];
  closedReason: SlotClosedReason | null;
  isLoading?: boolean;
  selectedStartAt?: string | null;
  onSelect: (slot: AvailableSlotDto) => void;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  if (closedReason) {
    return <EmptyState title="Not available on this day" description={CLOSED_REASON_LABELS[closedReason]} />;
  }

  if (slots.length === 0) {
    return <EmptyState title="No slots left" description="Every slot on this day is already taken. Try another date." />;
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
      {slots.map((slot) => {
        const isAvailable = slot.status === 'AVAILABLE';
        const isSelected = selectedStartAt === slot.startAt;
        return (
          <button
            key={slot.startAt}
            type="button"
            disabled={!isAvailable}
            onClick={() => onSelect(slot)}
            className={cn(
              'rounded-md border px-2 py-2 text-sm transition-colors',
              !isAvailable && 'text-muted-foreground cursor-not-allowed border-dashed bg-muted/40 line-through',
              isAvailable && !isSelected && 'border-input hover:bg-muted bg-transparent',
              isAvailable && isSelected && 'border-primary bg-primary text-primary-foreground',
            )}
          >
            {formatSlotTime(slot.startAt)}
          </button>
        );
      })}
    </div>
  );
}
