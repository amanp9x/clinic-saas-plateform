import type { DoctorReviewDto } from '@clinic/shared';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { RatingStars } from './rating-stars';
import { formatDate, initials } from '@/lib/format';

export function DoctorReviews({ reviews }: { reviews: DoctorReviewDto[] }) {
  if (reviews.length === 0) {
    return <p className="text-muted-foreground text-sm">No reviews yet.</p>;
  }

  return (
    <ul className="space-y-5">
      {reviews.map((review) => (
        <li key={review.id} className="flex gap-3 border-b pb-5 last:border-0 last:pb-0">
          <Avatar className="size-9 shrink-0">
            <AvatarFallback>{initials(review.authorName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{review.authorName}</p>
              <span className="text-muted-foreground text-xs">{formatDate(review.createdAt)}</span>
            </div>
            <RatingStars rating={review.rating} />
            <p className="text-muted-foreground text-sm">{review.comment}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
