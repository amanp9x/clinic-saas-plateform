'use client';

import { useState } from 'react';
import { CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import type { RefundRequestDto, RefundRequestStatus } from '@clinic/shared';
import { useApproveRefundRequest, useClinicRefundRequests, useRejectRefundRequest } from '@/hooks/clinic/use-refund-requests';
import { EmptyState } from '@/components/marketing/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api-client';
import { formatDate, formatFee } from '@/lib/format';

const STATUS_VARIANT: Record<RefundRequestStatus, 'secondary' | 'default' | 'destructive'> = {
  REQUESTED: 'secondary',
  APPROVED: 'default',
  REJECTED: 'destructive',
};

function RejectRefundDialog({ request }: { request: RefundRequestDto }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const reject = useRejectRefundRequest();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          Reject
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject refund request</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">{request.patientName} will see this reason.</p>
          <Textarea placeholder="Reason for rejecting" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={reason.trim().length < 3 || reject.isPending}
            onClick={() =>
              reject.mutate(
                { id: request.id, reviewNotes: reason.trim() },
                {
                  onSuccess: () => {
                    toast.success('Refund request rejected');
                    setOpen(false);
                    setReason('');
                  },
                  onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not reject request'),
                },
              )
            }
          >
            {reject.isPending ? 'Rejecting…' : 'Reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RefundRequestCard({ request }: { request: RefundRequestDto }) {
  const approve = useApproveRefundRequest();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{request.patientName}</CardTitle>
          <Badge variant={STATUS_VARIANT[request.status]}>{request.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-muted-foreground text-sm">
          <p>
            <span className="font-medium text-foreground">{request.amount ? formatFee(request.amount) : 'Full eligible amount'}</span> ·{' '}
            {request.bookingReference}
          </p>
          <p>Requested {formatDate(request.createdAt)}</p>
        </div>
        <p className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">&ldquo;{request.reason}&rdquo;</p>
        {request.status === 'REJECTED' && request.reviewNotes && <p className="text-destructive text-sm">Rejected: {request.reviewNotes}</p>}

        {request.status === 'REQUESTED' && (
          <div className="flex justify-end gap-2">
            <RejectRefundDialog request={request} />
            <Button
              size="sm"
              disabled={approve.isPending}
              onClick={() =>
                approve.mutate(
                  { id: request.id },
                  {
                    onSuccess: () => toast.success('Refund approved and processed'),
                    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not approve request'),
                  },
                )
              }
            >
              {approve.isPending ? 'Approving…' : 'Approve'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RefundRequestsPanel({ clinicId }: { clinicId: string | undefined }) {
  const [status, setStatus] = useState<RefundRequestStatus | 'ALL'>('REQUESTED');
  const { data, isLoading } = useClinicRefundRequests(clinicId, status === 'ALL' ? undefined : status);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-lg font-semibold">Refund requests</h2>
        <p className="text-muted-foreground text-sm">Patient-initiated refund requests for this clinic.</p>
      </div>

      <Tabs value={status} onValueChange={(v) => setStatus(v as RefundRequestStatus | 'ALL')}>
        <TabsList>
          <TabsTrigger value="REQUESTED">Requested</TabsTrigger>
          <TabsTrigger value="APPROVED">Approved</TabsTrigger>
          <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
          <TabsTrigger value="ALL">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading || !data ? (
        <Skeleton className="h-48 w-full" />
      ) : data.items.length === 0 ? (
        <EmptyState icon={CreditCard} title="No refund requests" description="Patient refund requests will show up here." />
      ) : (
        <div className="space-y-4">
          {data.items.map((request) => (
            <RefundRequestCard key={request.id} request={request} />
          ))}
        </div>
      )}
    </div>
  );
}
