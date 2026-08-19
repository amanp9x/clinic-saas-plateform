'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { LifeBuoy, Plus } from 'lucide-react';
import type { SupportTicketStatus } from '@clinic/shared';
import { useMySupportTickets } from '@/hooks/patient/use-support-tickets';
import { CreateSupportTicketDialog } from '@/components/patient/create-support-ticket-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';
import { formatDate } from '@/lib/format';

const STATUS_OPTIONS: SupportTicketStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

const STATUS_VARIANT: Record<SupportTicketStatus, 'secondary' | 'outline' | 'destructive'> = {
  OPEN: 'secondary',
  IN_PROGRESS: 'secondary',
  RESOLVED: 'outline',
  CLOSED: 'outline',
};

function SupportTicketsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = (searchParams.get('status') as SupportTicketStatus | null) ?? undefined;
  const [page, setPage] = useState(1);

  const { data, isLoading } = useMySupportTickets({ status, page });

  function updateStatus(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === 'all') params.delete('status');
    else params.set('status', value);
    router.push(`/support/tickets?${params.toString()}`);
    setPage(1);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Support</h1>
          <p className="text-muted-foreground text-sm">Raise an issue and track our replies here.</p>
        </div>
        <CreateSupportTicketDialog
          trigger={
            <Button>
              <Plus className="size-4" />
              New ticket
            </Button>
          }
        />
      </div>

      <Select value={status ?? 'all'} onValueChange={updateStatus}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {STATUS_OPTIONS.map((s) => (
            <SelectItem key={s} value={s}>
              {s.replace('_', ' ')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isLoading || !data ? (
        <Skeleton className="h-64 w-full" />
      ) : data.items.length === 0 ? (
        <EmptyState icon={LifeBuoy} title="No support tickets" description="When you raise an issue, it will show up here." />
      ) : (
        <div className="space-y-3">
          {data.items.map((ticket) => (
            <Link key={ticket.id} href={`/support/tickets/${ticket.id}`}>
              <Card className="transition-colors hover:bg-muted/40">
                <CardContent className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-muted-foreground text-xs">{ticket.ticketNumber}</p>
                    <p className="truncate text-sm font-medium">{ticket.subject}</p>
                    <p className="text-muted-foreground mt-1 text-xs">{ticket.category.replace('_', ' ')} · {formatDate(ticket.createdAt)}</p>
                  </div>
                  <Badge variant={STATUS_VARIANT[ticket.status]}>{ticket.status.replace('_', ' ')}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SupportTicketsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <SupportTicketsContent />
    </Suspense>
  );
}
