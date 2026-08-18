'use client';

import { Clock } from 'lucide-react';
import { useMyWaitlist } from '@/hooks/patient/use-waitlist';
import { WaitlistEntryCard } from '@/components/patient/waitlist-entry-card';
import { EmptyState } from '@/components/marketing/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

export default function MyWaitlistPage() {
  const { data, isLoading } = useMyWaitlist();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">My Waitlist</h1>
        <p className="text-muted-foreground text-sm">Doctors you&apos;re waiting for an opening with.</p>
      </div>

      {isLoading || !data ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="You're not waiting for anything"
          description="When a doctor is fully booked, you can join their waitlist from the booking page — we'll notify you if a slot opens up."
        />
      ) : (
        <div className="space-y-3">
          {data.items.map((entry) => (
            <WaitlistEntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
