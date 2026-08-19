'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { LifeBuoy } from 'lucide-react';
import type { SupportTicketCategory, SupportTicketStatus } from '@clinic/shared';
import { usePlatformSupportTickets } from '@/hooks/platform-admin/use-platform-support-tickets';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { formatDate } from '@/lib/format';

const STATUS_OPTIONS: SupportTicketStatus[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const CATEGORY_OPTIONS: SupportTicketCategory[] = ['APPOINTMENT', 'PAYMENT', 'DOCTOR_CONDUCT', 'CLINIC_SERVICE', 'TECHNICAL', 'OTHER'];

const STATUS_VARIANT: Record<SupportTicketStatus, 'secondary' | 'outline' | 'destructive'> = {
  OPEN: 'secondary',
  IN_PROGRESS: 'secondary',
  RESOLVED: 'outline',
  CLOSED: 'outline',
};

function PlatformTicketsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = (searchParams.get('status') as SupportTicketStatus | null) ?? undefined;
  const category = (searchParams.get('category') as SupportTicketCategory | null) ?? undefined;
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = usePlatformSupportTickets({ status, category, search: search || undefined, page });

  function updateParam(key: 'status' | 'category', value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === 'all') params.delete(key);
    else params.set(key, value);
    router.push(`/platform-admin/tickets?${params.toString()}`);
    setPage(1);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Support Tickets</h1>
        <p className="text-muted-foreground text-sm">Patient-raised issues awaiting triage or resolution.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={status ?? 'all'} onValueChange={(v) => updateParam('status', v)}>
          <SelectTrigger className="w-44">
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
        <Select value={category ?? 'all'} onValueChange={(v) => updateParam('category', v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORY_OPTIONS.map((c) => (
              <SelectItem key={c} value={c}>
                {c.replace('_', ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by ticket # or subject…"
          className="w-64"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading || !data ? (
            <Skeleton className="h-64 w-full" />
          ) : data.items.length === 0 ? (
            <EmptyState icon={LifeBuoy} title="No tickets found" description="No matching support tickets for this filter." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Raised by</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Clinic</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-medium">
                      <p>{ticket.subject}</p>
                      <p className="text-muted-foreground text-xs">{ticket.ticketNumber}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{ticket.raisedByName}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{ticket.category.replace('_', ' ')}</TableCell>
                    <TableCell className="text-muted-foreground">{ticket.clinicName ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[ticket.status]}>{ticket.status.replace('_', ' ')}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{formatDate(ticket.createdAt)}</TableCell>
                    <TableCell>
                      <Link href={`/platform-admin/tickets/${ticket.id}`} className="text-primary text-sm font-medium hover:underline">
                        Review
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data && data.totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setPage((p) => Math.max(1, p - 1));
                }}
                aria-disabled={page <= 1}
                className={page <= 1 ? 'pointer-events-none opacity-50' : undefined}
              />
            </PaginationItem>
            <PaginationItem>
              <span className="text-muted-foreground px-3 text-sm">
                Page {data.page} of {data.totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setPage((p) => Math.min(data.totalPages, p + 1));
                }}
                aria-disabled={page >= data.totalPages}
                className={page >= data.totalPages ? 'pointer-events-none opacity-50' : undefined}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}

export default function PlatformAdminTicketsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <PlatformTicketsContent />
    </Suspense>
  );
}
