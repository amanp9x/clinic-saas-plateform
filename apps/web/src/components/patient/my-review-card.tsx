'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Star } from 'lucide-react';
import type { MyReviewDto } from '@clinic/shared';
import { useDeleteReview, useUpdateReview } from '@/hooks/patient/use-reviews';
import { ApiError } from '@/lib/api-client';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { StarRatingInput } from './star-rating-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const STATUS_LABEL: Record<MyReviewDto['status'], string> = {
  PENDING: 'Pending review',
  PUBLISHED: 'Published',
  HIDDEN: 'Hidden by clinic',
  REJECTED: 'Rejected',
};

export function MyReviewCard({ review }: { review: MyReviewDto }) {
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(review.rating);
  const [comment, setComment] = useState(review.comment ?? '');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const updateReview = useUpdateReview();
  const deleteReview = useDeleteReview();

  function handleSave() {
    updateReview.mutate(
      { id: review.id, rating, comment: comment.trim() || null },
      {
        onSuccess: () => {
          toast.success('Review updated');
          setEditing(false);
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update review'),
      },
    );
  }

  function handleDelete() {
    deleteReview.mutate(review.id, {
      onSuccess: () => {
        toast.success('Review deleted');
        setDeleteOpen(false);
      },
      onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not delete review'),
    });
  }

  const subject = review.type === 'DOCTOR' ? review.doctorName : review.clinicName;

  return (
    <Card>
      <CardContent className="space-y-2 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {review.type === 'DOCTOR' ? 'Doctor' : 'Clinic'}
            </Badge>
            <p className="font-medium">{subject}</p>
            {review.status !== 'PUBLISHED' && (
              <Badge variant="secondary" className="text-xs">
                {STATUS_LABEL[review.status]}
              </Badge>
            )}
          </div>
          {!editing && (
            <div className="flex items-center gap-1 text-amber-500">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} className={`size-3.5 ${i < review.rating ? 'fill-amber-500' : ''}`} />
              ))}
            </div>
          )}
        </div>
        <p className="text-muted-foreground text-xs">{formatDate(review.createdAt)}</p>

        {editing ? (
          <div className="space-y-3 pt-1">
            <StarRatingInput label="Rating" value={rating} onChange={setRating} />
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Update your comment…" />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  setRating(review.rating);
                  setComment(review.comment ?? '');
                }}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateReview.isPending}>
                {updateReview.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {review.comment && <p className="text-sm">{review.comment}</p>}

            {review.response && (
              <div className="bg-muted mt-2 rounded-lg p-3 text-sm">
                <p className="font-medium">Response from {subject}</p>
                <p className="text-muted-foreground">{review.response}</p>
              </div>
            )}

            {(review.canEdit || review.canDelete) && (
              <div className="flex gap-2 pt-1">
                {review.canEdit && (
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                )}
                {review.canDelete && (
                  <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                    <DialogTrigger>
                      <Button size="sm" variant="destructive">
                        Delete
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete this review?</DialogTitle>
                        <DialogDescription>This cannot be undone.</DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
                          Keep review
                        </Button>
                        <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleteReview.isPending}>
                          {deleteReview.isPending ? 'Deleting…' : 'Delete review'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
