'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import type { DocumentExpiryStatus } from '@clinic/shared';
import { usePlatformComplianceDocuments } from '@/hooks/platform-admin/use-platform-admin';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { formatDate } from '@/lib/format';

const STATUS_OPTIONS: Extract<DocumentExpiryStatus, 'EXPIRING_SOON' | 'EXPIRED'>[] = ['EXPIRING_SOON', 'EXPIRED'];

function ComplianceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = (searchParams.get('status') as 'EXPIRING_SOON' | 'EXPIRED' | null) ?? undefined;
  const [page, setPage] = useState(1);

  const { data, isLoading } = usePlatformComplianceDocuments({ status, page });

  function updateStatus(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === 'all') params.delete('status');
    else params.set('status', value);
    router.push(`/platform-admin/compliance?${params.toString()}`);
    setPage(1);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Compliance</h1>
        <p className="text-muted-foreground text-sm">Clinic registration, license, and tax documents nearing or past their expiry date, across the platform.</p>
      </div>

      <Select value={status ?? 'all'} onValueChange={updateStatus}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Expiring soon + expired" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Expiring soon + expired</SelectItem>
          {STATUS_OPTIONS.map((s) => (
            <SelectItem key={s} value={s}>
              {s.replace('_', ' ')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Card>
        <CardContent className="p-0">
          {isLoading || !data ? (
            <Skeleton className="h-64 w-full" />
          ) : data.items.length === 0 ? (
            <EmptyState icon={ShieldAlert} title="Nothing at risk" description="No clinic documents are expiring soon or expired." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clinic</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Expiry date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.clinicName}</TableCell>
                    <TableCell className="text-muted-foreground">{doc.fileName}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{doc.type.replace(/_/g, ' ')}</TableCell>
                    <TableCell>{formatDate(doc.expiryDate)}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">{doc.expiryStatus.replace('_', ' ')}</Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/platform-admin/clinics/${doc.clinicId}`} className="text-primary text-sm font-medium hover:underline">
                        View clinic
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

export default function PlatformAdminCompliancePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ComplianceContent />
    </Suspense>
  );
}
