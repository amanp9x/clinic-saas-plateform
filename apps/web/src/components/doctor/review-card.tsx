'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Star } from 'lucide-react';
import type { DoctorReviewDetailDto } from '@clinic/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useRespondToReview } from '@/hooks/doctor/use-doctor-reviews';
import { ApiError } from '@/lib/api-client';
import { formatDate } from '@/lib/format';

export function ReviewCard({ review }: { review: DoctorReviewDetailDto }) {
  const [responding, setResponding] = useState(false);
  const [response, setResponse] = useState('');
  const respondToReview = useRespondToReview();

  function handleSubmit() {
    if (!response.trim()) {
      toast.error('Enter a response');
      return;
    }
    respondToReview.mutate(
      { id: review.id, response: response.trim() },
      {
        onSuccess: () => {
          toast.success('Response posted');
          setResponding(false);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not post response'),
      },
    );
  }

  return (
    <Card>
      <CardContent className="space-y-2 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="font-medium">{review.authorName}</p>
            {review.status !== 'PUBLISHED' && (
              <Badge variant="secondary" className="text-xs">
                {review.status === 'HIDDEN' ? 'Hidden' : review.status === 'REJECTED' ? 'Rejected' : 'Pending'}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 text-amber-500">
            {Array.from({ length: 5 }, (_, i) => (
              <Star key={i} className={`size-3.5 ${i < review.rating ? 'fill-amber-500' : ''}`} />
            ))}
          </div>
        </div>
        <p className="text-muted-foreground text-xs">{formatDate(review.createdAt)}</p>
        <p className="text-sm">{review.comment}</p>

        {review.response ? (
          <div className="bg-muted mt-2 rounded-lg p-3 text-sm">
            <p className="font-medium">Your response</p>
            <p className="text-muted-foreground">{review.response}</p>
          </div>
        ) : responding ? (
          <div className="space-y-2 pt-2">
            <Textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Write a response to this review…"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setResponding(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={respondToReview.isPending}>
                {respondToReview.isPending ? 'Posting…' : 'Post response'}
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setResponding(true)}>
            Respond
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
