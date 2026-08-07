import { Quote } from 'lucide-react';
import type { TestimonialDto } from '@clinic/shared';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { RatingStars } from './rating-stars';
import { initials } from '@/lib/format';

export function TestimonialCard({ testimonial }: { testimonial: TestimonialDto }) {
  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-4">
        <Quote className="text-primary/40 size-6" />
        <p className="text-foreground/90 flex-1 text-sm">{testimonial.message}</p>
        <div className="flex items-center justify-between gap-3 border-t pt-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-9">
              {testimonial.avatarUrl && (
                <AvatarImage src={testimonial.avatarUrl} alt={testimonial.authorName} />
              )}
              <AvatarFallback>{initials(testimonial.authorName)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{testimonial.authorName}</p>
              {testimonial.authorDetail && (
                <p className="text-muted-foreground text-xs">{testimonial.authorDetail}</p>
              )}
            </div>
          </div>
          {testimonial.rating !== null && <RatingStars rating={testimonial.rating} />}
        </div>
      </CardContent>
    </Card>
  );
}
