'use client';

import { useState } from 'react';
import { IndianRupee } from 'lucide-react';
import { toast } from 'sonner';
import type { SettlementRequestDto, SettlementStatus } from '@clinic/shared';
import { usePlatformSettlements, useApproveSettlement, useRejectSettlement, useMarkSettlementPaid } from '@/hooks/platform-admin/use-platform-settlements';
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

const STATUS_VARIANT: Record<SettlementStatus, 'secondary' | 'default' | 'destructive' | 'outline'> = {
  REQUESTED: 'secondary',
  APPROVED: 'default',
  REJECTED: 'destructive',
  PAID: 'outline',
};

function RejectDialog({ settlement }: { settlement: SettlementRequestDto }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const reject = useRejectSettlement();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          Reject
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject settlement request</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">Let {settlement.doctorName} know why — this is shared with them.</p>
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
                { id: settlement.id, reviewNotes: reason.trim() },
                {
                  onSuccess: () => {
                    toast.success('Settlement rejected');
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

function SettlementCard({ settlement }: { settlement: SettlementRequestDto }) {
  const approve = useApproveSettlement();
  const markPaid = useMarkSettlementPaid();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{settlement.doctorName}</CardTitle>
          <Badge variant={STATUS_VARIANT[settlement.status]}>{settlement.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-muted-foreground text-sm">
          <p>
            <span className="font-medium text-foreground">{formatFee(settlement.amount)}</span> for {formatDate(settlement.periodStart)} –{' '}
            {formatDate(settlement.periodEnd)}
          </p>
          <p>Requested {formatDate(settlement.createdAt)}</p>
        </div>
        {settlement.doctorNotes && <p className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">&ldquo;{settlement.doctorNotes}&rdquo;</p>}
        {settlement.status === 'REJECTED' && settlement.reviewNotes && <p className="text-destructive text-sm">Rejected: {settlement.reviewNotes}</p>}
        {settlement.status === 'PAID' && <p className="text-muted-foreground text-sm">Paid {settlement.paidAt ? formatDate(settlement.paidAt) : ''}</p>}

        {settlement.status === 'REQUESTED' && (
          <div className="flex justify-end gap-2">
            <RejectDialog settlement={settlement} />
            <Button
              size="sm"
              disabled={approve.isPending}
              onClick={() =>
                approve.mutate(
                  { id: settlement.id },
                  {
                    onSuccess: () => toast.success('Settlement approved'),
                    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not approve request'),
                  },
                )
              }
            >
              {approve.isPending ? 'Approving…' : 'Approve'}
            </Button>
          </div>
        )}
        {settlement.status === 'APPROVED' && (
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              disabled={markPaid.isPending}
              onClick={() =>
                markPaid.mutate(
                  { id: settlement.id },
                  {
                    onSuccess: () => toast.success('Marked as paid'),
                    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not mark as paid'),
                  },
                )
              }
            >
              {markPaid.isPending ? 'Saving…' : 'Mark paid'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PlatformAdminSettlementsPage() {
  const [status, setStatus] = useState<SettlementStatus | 'ALL'>('REQUESTED');
  const { data, isLoading } = usePlatformSettlements(status === 'ALL' ? undefined : status);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Settlements</h1>
        <p className="text-muted-foreground text-sm">Doctor earnings settlement requests awaiting review or payout.</p>
      </div>

      <Tabs value={status} onValueChange={(v) => setStatus(v as SettlementStatus | 'ALL')}>
        <TabsList>
          <TabsTrigger value="REQUESTED">Requested</TabsTrigger>
          <TabsTrigger value="APPROVED">Approved</TabsTrigger>
          <TabsTrigger value="PAID">Paid</TabsTrigger>
          <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
          <TabsTrigger value="ALL">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading || !data ? (
        <Skeleton className="h-64 w-full" />
      ) : data.items.length === 0 ? (
        <EmptyState icon={IndianRupee} title="No settlement requests" description="Doctor settlement requests will show up here." />
      ) : (
        <div className="space-y-4">
          {data.items.map((settlement) => (
            <SettlementCard key={settlement.id} settlement={settlement} />
          ))}
        </div>
      )}
    </div>
  );
}
