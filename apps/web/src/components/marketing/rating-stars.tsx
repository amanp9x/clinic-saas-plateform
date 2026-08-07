import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export function RatingStars({
  rating,
  count,
  size = 'sm',
}: {
  rating: number | null;
  count?: number;
  size?: 'sm' | 'md';
}) {
  if (rating === null) {
    return <span className="text-muted-foreground text-xs">No ratings yet</span>;
  }

  const starSize = size === 'sm' ? 'size-3.5' : 'size-4';

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              starSize,
              i < Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'fill-muted text-muted',
            )}
          />
        ))}
      </div>
      <span className="text-sm font-medium">{rating.toFixed(1)}</span>
      {count !== undefined && <span className="text-muted-foreground text-xs">({count})</span>}
    </div>
  );
}
