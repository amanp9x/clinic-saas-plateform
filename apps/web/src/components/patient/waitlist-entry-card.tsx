'use client';

import Link from 'next/link';
import { toast } from 'sonner';
import type { WaitlistEntryDto } from '@clinic/shared';
import { useCancelWaitlistEntry } from '@/hooks/patient/use-waitlist';
import { ApiError } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const STATUS_VARIANT: Record<WaitlistEntryDto['status'], 'secondary' | 'outline' | 'destructive'> = {
  ACTIVE: 'secondary',
  NOTIFIED: 'secondary',
  FULFILLED: 'outline',
  CANCELLED: 'destructive',
  EXPIRED: 'outline',
};

const STATUS_LABEL: Record<WaitlistEntryDto['status'], string> = {
  ACTIVE: 'Waiting',
  NOTIFIED: 'Slot available!',
  FULFILLED: 'Booked',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};

export function WaitlistEntryCard({ entry }: { entry: WaitlistEntryDto }) {
  const cancelEntry = useCancelWaitlistEntry();

  function handleCancel() {
    cancelEntry.mutate(entry.id, {
      onSuccess: () => toast.success('Removed from waitlist'),
      onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not remove from waitlist'),
    });
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{entry.doctorName}</p>
            <Badge variant={STATUS_VARIANT[entry.status]} className="text-xs">
              {STATUS_LABEL[entry.status]}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">{entry.clinicName}</p>
          <p className="text-muted-foreground text-xs">{formatDate(`${entry.targetDate}T00:00:00.000Z`)}</p>
          {entry.notes && <p className="text-muted-foreground text-xs italic">&ldquo;{entry.notes}&rdquo;</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {entry.status === 'NOTIFIED' && (
            <Button size="sm" render={<Link href={`/book?doctorId=${entry.doctorId}&clinicId=${entry.clinicId}&doctorName=${encodeURIComponent(entry.doctorName)}`} />}>
              Book now
            </Button>
          )}
          {entry.canCancel && (
            <Button size="sm" variant="outline" onClick={handleCancel} disabled={cancelEntry.isPending}>
              {cancelEntry.isPending ? 'Removing…' : 'Remove'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
