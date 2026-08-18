'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2 } from 'lucide-react';
import type { ClinicVerificationStatus } from '@clinic/shared';
import { usePlatformClinics } from '@/hooks/platform-admin/use-platform-admin';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

const STATUS_OPTIONS: ClinicVerificationStatus[] = ['PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED'];

const STATUS_VARIANT: Record<ClinicVerificationStatus, 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'outline',
  SUBMITTED: 'secondary',
  UNDER_REVIEW: 'secondary',
  VERIFIED: 'outline',
  REJECTED: 'destructive',
  SUSPENDED: 'destructive',
};

function ClinicsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verificationStatus = (searchParams.get('verificationStatus') as ClinicVerificationStatus | null) ?? undefined;
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = usePlatformClinics({ verificationStatus, search: search || undefined, page });

  function updateStatus(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === 'all') params.delete('verificationStatus');
    else params.set('verificationStatus', value);
    router.push(`/platform-admin/clinics?${params.toString()}`);
    setPage(1);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Clinics</h1>
        <p className="text-muted-foreground text-sm">Every clinic on the platform.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={verificationStatus ?? 'all'} onValueChange={updateStatus}>
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
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by name or city…"
          className="w-64"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading || !data ? (
            <Skeleton className="h-64 w-full" />
          ) : data.items.length === 0 ? (
            <EmptyState icon={Building2} title="No clinics found" description="No matching clinics for this filter." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Clinic</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Doctors</TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead>Operating</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((clinic) => (
                  <TableRow key={clinic.id}>
                    <TableCell className="font-medium">{clinic.name}</TableCell>
                    <TableCell className="text-muted-foreground">{clinic.city ?? '—'}</TableCell>
                    <TableCell>{clinic.doctorCount}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[clinic.verificationStatus]}>{clinic.verificationStatus.replace('_', ' ')}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{clinic.operatingStatus.replace('_', ' ')}</TableCell>
                    <TableCell>
                      <Link href={`/platform-admin/clinics/${clinic.id}`} className="text-primary text-sm font-medium hover:underline">
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

export default function PlatformAdminClinicsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ClinicsContent />
    </Suspense>
  );
}
