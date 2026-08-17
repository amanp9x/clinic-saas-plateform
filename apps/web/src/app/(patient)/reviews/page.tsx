'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { useMyReviews } from '@/hooks/patient/use-reviews';
import { MyReviewCard } from '@/components/patient/my-review-card';
import { EmptyState } from '@/components/marketing/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

export default function MyReviewsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useMyReviews(page);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">My Reviews</h1>
        <p className="text-muted-foreground text-sm">Reviews you&apos;ve left for doctors and clinics.</p>
      </div>

      {isLoading || !data ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Star}
          title="No reviews yet"
          description="After a completed appointment, you can rate your experience from the Appointments tab."
        />
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            {data.items.map((review) => (
              <MyReviewCard key={review.id} review={review} />
            ))}
          </div>

          {data.totalPages > 1 && (
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
      )}
    </div>
  );
}
