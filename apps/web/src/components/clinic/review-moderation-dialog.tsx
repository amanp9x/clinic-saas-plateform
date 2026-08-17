'use client';

import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Star } from 'lucide-react';
import type { ReviewModerationRowDto, ReviewStatusValue } from '@clinic/shared';
import { useModerateReview, useRespondToClinicReview } from '@/hooks/clinic/use-clinic-reviews';
import { ApiError } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const STATUS_ACTIONS: { status: ReviewStatusValue; label: string; variant: 'default' | 'outline' | 'destructive' }[] = [
  { status: 'PUBLISHED', label: 'Publish', variant: 'default' },
  { status: 'HIDDEN', label: 'Hide', variant: 'outline' },
  { status: 'REJECTED', label: 'Reject', variant: 'destructive' },
];

export function ReviewModerationDialog({ review, trigger }: { review: ReviewModerationRowDto; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [response, setResponse] = useState('');
  const moderate = useModerateReview();
  const respond = useRespondToClinicReview();

  function handleModerate(status: ReviewStatusValue) {
    moderate.mutate(
      { id: review.id, status, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(`Review ${status.toLowerCase()}`);
          setReason('');
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update review'),
      },
    );
  }

  function handleRespond() {
    if (!response.trim()) {
      toast.error('Enter a response');
      return;
    }
    respond.mutate(
      { id: review.id, response: response.trim() },
      {
        onSuccess: () => {
          toast.success('Response posted');
          setResponse('');
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not post response'),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{review.type === 'DOCTOR' ? review.doctorName : 'Clinic review'}</DialogTitle>
          <DialogDescription>
            By {review.patientName} on {formatDateTime(review.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-amber-500">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} className={`size-4 ${i < review.rating ? 'fill-amber-500' : ''}`} />
              ))}
            </div>
            <Badge variant="secondary">{review.status}</Badge>
          </div>

          {review.comment && <p className="text-sm">{review.comment}</p>}

          {review.response && (
            <div className="bg-muted rounded-lg p-3 text-sm">
              <p className="font-medium">Provider response</p>
              <p className="text-muted-foreground">{review.response}</p>
              {review.respondedAt && <p className="text-muted-foreground mt-1 text-xs">{formatDateTime(review.respondedAt)}</p>}
            </div>
          )}

          {review.moderationReason && (
            <p className="text-muted-foreground text-xs">Last moderation note: {review.moderationReason}</p>
          )}

          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="mod-reason">Moderation note (optional)</Label>
            <Textarea id="mod-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for this action…" />
            <div className="flex flex-wrap gap-2 pt-1">
              {STATUS_ACTIONS.filter((a) => a.status !== review.status).map((a) => (
                <Button key={a.status} size="sm" variant={a.variant} onClick={() => handleModerate(a.status)} disabled={moderate.isPending}>
                  {a.label}
                </Button>
              ))}
            </div>
          </div>

          {!review.response && (
            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="mod-response">Respond to this review</Label>
              <Textarea id="mod-response" rows={3} value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Write a public response…" />
              <div className="flex justify-end">
                <Button size="sm" onClick={handleRespond} disabled={respond.isPending}>
                  {respond.isPending ? 'Posting…' : 'Post response'}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
