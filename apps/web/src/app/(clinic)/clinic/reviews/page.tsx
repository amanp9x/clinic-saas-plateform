'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star } from 'lucide-react';
import type { ReviewStatusValue } from '@clinic/shared';
import { useSelectedClinic } from '@/hooks/clinic/use-selected-clinic';
import { useClinicReviews } from '@/hooks/clinic/use-clinic-reviews';
import { ReviewModerationDialog } from '@/components/clinic/review-moderation-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';
import { formatDateTime } from '@/lib/format';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

const STATUS_OPTIONS: ReviewStatusValue[] = ['PENDING', 'PUBLISHED', 'HIDDEN', 'REJECTED'];

function ClinicReviewsContent() {
  const router = useRouter();
  const { clinics, clinicId, isLoading: clinicsLoading } = useSelectedClinic();
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useClinicReviews(clinicId, {
    type: (type || undefined) as 'DOCTOR' | 'CLINIC' | undefined,
    status: (status || undefined) as ReviewStatusValue | undefined,
    search: search || undefined,
    page,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Reviews</h1>
          <p className="text-muted-foreground text-sm">Moderate patient reviews for doctors and this clinic.</p>
        </div>
        {clinics.length > 1 && (
          <Select value={clinicId} onValueChange={(value) => value && router.push(`/clinic/reviews?clinicId=${value}`)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select a clinic" />
            </SelectTrigger>
            <SelectContent>
              {clinics.map((c) => (
                <SelectItem key={c.clinicId} value={c.clinicId}>
                  {c.clinicName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {clinicsLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !clinicId ? (
        <EmptyState title="No clinic associated" description="You are not assigned to any clinic yet." />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={type || 'all'}
                onValueChange={(v) => {
                  setType(v === 'all' ? '' : (v ?? ''));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="DOCTOR">Doctor</SelectItem>
                  <SelectItem value="CLINIC">Clinic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status || 'all'}
                onValueChange={(v) => {
                  setStatus(v === 'all' ? '' : (v ?? ''));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="search">Search patient</Label>
              <Input
                id="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Patient name…"
                className="w-48"
              />
            </div>
          </div>

          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (data?.items.length ?? 0) === 0 ? (
            <EmptyState icon={Star} title="No reviews" description="No matching reviews for this filter." />
          ) : (
            <>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead>Rating</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data!.items.map((review) => (
                        <TableRow key={review.id}>
                          <TableCell className="text-muted-foreground text-xs">{formatDateTime(review.createdAt)}</TableCell>
                          <TableCell>{review.type === 'DOCTOR' ? 'Doctor' : 'Clinic'}</TableCell>
                          <TableCell>{review.doctorName ?? 'Clinic'}</TableCell>
                          <TableCell>{review.patientName}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1">
                              <Star className="size-3.5 fill-amber-500 text-amber-500" />
                              {review.rating}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{review.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <ReviewModerationDialog
                              review={review}
                              trigger={
                                <Button size="sm" variant="outline">
                                  Review
                                </Button>
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {data!.totalPages > 1 && (
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
                        Page {data!.page} of {data!.totalPages}
                      </span>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setPage((p) => Math.min(data!.totalPages, p + 1));
                        }}
                        aria-disabled={page >= data!.totalPages}
                        className={page >= data!.totalPages ? 'pointer-events-none opacity-50' : undefined}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ClinicReviewsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ClinicReviewsContent />
    </Suspense>
  );
}
