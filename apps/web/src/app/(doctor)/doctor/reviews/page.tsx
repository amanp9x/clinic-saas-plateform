'use client';

import { Star } from 'lucide-react';
import { useDoctorReviews } from '@/hooks/doctor/use-doctor-reviews';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/marketing/empty-state';
import { ReviewCard } from '@/components/doctor/review-card';
import { Skeleton } from '@/components/ui/skeleton';

export default function ReviewsPage() {
  const { data: reviews, isLoading } = useDoctorReviews();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Reviews</h1>
        <p className="text-muted-foreground text-sm">See what patients are saying and respond where you can.</p>
      </div>

      {isLoading || !reviews ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="size-4" />
                  Average Rating
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">
                  {reviews.ratingAverage != null ? reviews.ratingAverage.toFixed(1) : '—'}
                </p>
                <p className="text-muted-foreground text-sm">{reviews.ratingCount} total reviews</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Rating Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {reviews.breakdown.map((b) => (
                  <div key={b.rating} className="flex items-center gap-2 text-sm">
                    <span className="w-8">{b.rating}★</span>
                    <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-full"
                        style={{ width: reviews.ratingCount ? `${(b.count / reviews.ratingCount) * 100}%` : '0%' }}
                      />
                    </div>
                    <span className="text-muted-foreground w-6 text-right">{b.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {Object.values(reviews.dimensionAverages).some((v) => v !== null) && (
            <Card>
              <CardHeader>
                <CardTitle>Dimension Averages</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: 'Consultation', value: reviews.dimensionAverages.consultationExperience },
                  { label: 'Communication', value: reviews.dimensionAverages.communication },
                  { label: 'Professionalism', value: reviews.dimensionAverages.professionalism },
                  { label: 'Clarity', value: reviews.dimensionAverages.explanationClarity },
                ].map((d) => (
                  <div key={d.label}>
                    <p className="text-muted-foreground text-xs">{d.label}</p>
                    <p className="text-lg font-semibold">{d.value != null ? d.value.toFixed(1) : '—'}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            <h2 className="font-heading text-lg font-semibold">Recent Reviews</h2>
            {reviews.recentReviews.length === 0 ? (
              <EmptyState title="No reviews yet" />
            ) : (
              reviews.recentReviews.map((review) => <ReviewCard key={review.id} review={review} />)
            )}
          </div>
        </>
      )}
    </div>
  );
}
