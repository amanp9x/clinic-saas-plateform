'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail } from 'lucide-react';
import type { ContactMessageStatus } from '@clinic/shared';
import { usePlatformContactMessages } from '@/hooks/platform-admin/use-platform-contact-messages';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { formatDate } from '@/lib/format';

const STATUS_OPTIONS: ContactMessageStatus[] = ['NEW', 'IN_PROGRESS', 'RESOLVED'];

const STATUS_VARIANT: Record<ContactMessageStatus, 'secondary' | 'outline'> = {
  NEW: 'secondary',
  IN_PROGRESS: 'secondary',
  RESOLVED: 'outline',
};

function PlatformContactMessagesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = (searchParams.get('status') as ContactMessageStatus | null) ?? undefined;
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = usePlatformContactMessages({ status, search: search || undefined, page });

  function updateStatus(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === 'all') params.delete('status');
    else params.set('status', value);
    router.push(`/platform-admin/contact-messages?${params.toString()}`);
    setPage(1);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Contact Messages</h1>
        <p className="text-muted-foreground text-sm">Inquiries submitted through the public contact form.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={status ?? 'all'} onValueChange={updateStatus}>
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
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by name, email, or subject…"
          className="w-72"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading || !data ? (
            <Skeleton className="h-64 w-full" />
          ) : data.items.length === 0 ? (
            <EmptyState icon={Mail} title="No messages found" description="No matching contact messages for this filter." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.subject}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <p>{m.name}</p>
                      <p className="text-xs">{m.email}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[m.status]}>{m.status.replace('_', ' ')}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{formatDate(m.createdAt)}</TableCell>
                    <TableCell>
                      <Link href={`/platform-admin/contact-messages/${m.id}`} className="text-primary text-sm font-medium hover:underline">
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

export default function PlatformAdminContactMessagesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <PlatformContactMessagesContent />
    </Suspense>
  );
}
