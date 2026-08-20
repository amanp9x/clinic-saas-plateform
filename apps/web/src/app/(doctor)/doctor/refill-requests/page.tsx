'use client';

import { useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import type { RefillRequestDto, RefillRequestStatus } from '@clinic/shared';
import { useDoctorRefillRequests, useRespondToRefillRequest } from '@/hooks/doctor/use-refill-requests';
import { EmptyState } from '@/components/marketing/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api-client';
import { formatDate } from '@/lib/format';

const STATUS_VARIANT: Record<RefillRequestStatus, 'secondary' | 'default' | 'destructive'> = {
  PENDING: 'secondary',
  APPROVED: 'default',
  DECLINED: 'destructive',
};

function DeclineDialog({ request }: { request: RefillRequestDto }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const respond = useRespondToRefillRequest();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          Decline
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Decline refill request</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">Let {request.patientName} know why — this is shared with them.</p>
          <Textarea placeholder="Reason for declining" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!note.trim() || respond.isPending}
            onClick={() =>
              respond.mutate(
                { id: request.id, status: 'DECLINED', doctorNote: note },
                {
                  onSuccess: () => {
                    toast.success('Refill request declined');
                    setOpen(false);
                    setNote('');
                  },
                  onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not decline request'),
                },
              )
            }
          >
            {respond.isPending ? 'Declining…' : 'Decline'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RefillRequestCard({ request }: { request: RefillRequestDto }) {
  const respond = useRespondToRefillRequest();

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
            <span className="font-medium text-foreground">Medicines: </span>
            {request.originalPrescription.medicineNames.join(', ') || '—'}
          </p>
          <p>Originally issued {formatDate(request.originalPrescription.issuedAt)} · Requested {formatDate(request.requestedAt)}</p>
        </div>
        {request.patientNote && <p className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">&ldquo;{request.patientNote}&rdquo;</p>}
        {request.status === 'DECLINED' && request.doctorNote && (
          <p className="text-destructive text-sm">Declined: {request.doctorNote}</p>
        )}
        {request.status === 'APPROVED' && (
          <p className="text-muted-foreground text-sm">A draft prescription was created — finalize it from Prescriptions.</p>
        )}
        {request.status === 'PENDING' && (
          <div className="flex justify-end gap-2">
            <DeclineDialog request={request} />
            <Button
              size="sm"
              disabled={respond.isPending}
              onClick={() =>
                respond.mutate(
                  { id: request.id, status: 'APPROVED' },
                  {
                    onSuccess: () => toast.success('Refill approved — draft prescription created'),
                    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not approve request'),
                  },
                )
              }
            >
              {respond.isPending ? 'Approving…' : 'Approve'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DoctorRefillRequestsPage() {
  const [status, setStatus] = useState<RefillRequestStatus | 'ALL'>('PENDING');
  const { data, isLoading } = useDoctorRefillRequests(status === 'ALL' ? undefined : status);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Refill Requests</h1>
        <p className="text-muted-foreground text-sm">Patients requesting a refill of a prescription you issued.</p>
      </div>

      <Tabs value={status} onValueChange={(v) => setStatus(v as RefillRequestStatus | 'ALL')}>
        <TabsList>
          <TabsTrigger value="PENDING">Pending</TabsTrigger>
          <TabsTrigger value="APPROVED">Approved</TabsTrigger>
          <TabsTrigger value="DECLINED">Declined</TabsTrigger>
          <TabsTrigger value="ALL">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading || !data ? (
        <Skeleton className="h-64 w-full" />
      ) : data.items.length === 0 ? (
        <EmptyState icon={RefreshCcw} title="No refill requests" description="Refill requests from your patients will show up here." />
      ) : (
        <div className="space-y-4">
          {data.items.map((request) => (
            <RefillRequestCard key={request.id} request={request} />
          ))}
        </div>
      )}
    </div>
  );
}
