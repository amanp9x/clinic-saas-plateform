'use client';

import { useState } from 'react';
import { Pill } from 'lucide-react';
import { toast } from 'sonner';
import type { PrescriptionDto, RefillRequestDto } from '@clinic/shared';
import { usePrescriptions } from '@/hooks/patient/use-medical-records';
import { usePatientRefillRequests, useRequestRefill } from '@/hooks/patient/use-prescription-refills';
import { EmptyState } from '@/components/marketing/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api-client';
import { formatDate } from '@/lib/format';

function latestRequestFor(requests: RefillRequestDto[] | undefined, prescriptionId: string): RefillRequestDto | undefined {
  return requests?.find((r) => r.prescriptionId === prescriptionId);
}

function RefillAction({ prescription, latest }: { prescription: PrescriptionDto; latest: RefillRequestDto | undefined }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const requestRefill = useRequestRefill(prescription.id);

  if (latest?.status === 'PENDING') {
    return <Badge variant="secondary">Refill requested</Badge>;
  }

  if (latest?.status === 'APPROVED') {
    return <Badge variant="secondary">Refill approved — new prescription in progress</Badge>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {latest?.status === 'DECLINED' && (
        <p className="text-muted-foreground max-w-xs text-right text-xs">
          Previous request declined{latest.doctorNote ? `: ${latest.doctorNote}` : '.'}
        </p>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger>
          <Button variant="outline" size="sm">
            {latest?.status === 'DECLINED' ? 'Request again' : 'Request refill'}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a refill</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              Your doctor will review this request. You&apos;ll be notified once a decision is made.
            </p>
            <Textarea
              placeholder="Optional note for your doctor (e.g. running low, same dosage)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={requestRefill.isPending}
              onClick={() =>
                requestRefill.mutate(
                  { patientNote: note },
                  {
                    onSuccess: () => {
                      toast.success('Refill request submitted');
                      setOpen(false);
                      setNote('');
                    },
                    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not submit refill request'),
                  },
                )
              }
            >
              {requestRefill.isPending ? 'Submitting…' : 'Submit request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PrescriptionsPage() {
  const { data: prescriptions, isLoading } = usePrescriptions();
  const { data: refillRequests } = usePatientRefillRequests();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!prescriptions || prescriptions.length === 0) {
    return (
      <EmptyState
        icon={Pill}
        title="No prescriptions yet"
        description="Prescriptions issued by your doctors will appear here."
      />
    );
  }

  return (
    <div className="space-y-4">
      {prescriptions.map((prescription) => (
        <Card key={prescription.id}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">{prescription.doctorName}</CardTitle>
              <span className="text-muted-foreground text-xs">{formatDate(prescription.issuedAt)}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {prescription.medications.length > 0 && (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-muted-foreground text-xs">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Medicine</th>
                      <th className="px-3 py-2 text-left font-medium">Dosage</th>
                      <th className="px-3 py-2 text-left font-medium">Frequency</th>
                      <th className="px-3 py-2 text-left font-medium">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {prescription.medications.map((med, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-medium">{med.name}</td>
                        <td className="px-3 py-2">{med.dosage}</td>
                        <td className="px-3 py-2">{med.frequency}</td>
                        <td className="px-3 py-2">{med.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {prescription.notes && <p className="text-muted-foreground text-sm">{prescription.notes}</p>}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {prescription.fileUrl ? (
                <a
                  href={prescription.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary text-sm font-medium hover:underline"
                >
                  Download prescription
                </a>
              ) : (
                <span />
              )}
              {prescription.status === 'FINALIZED' && (
                <RefillAction prescription={prescription} latest={latestRequestFor(refillRequests, prescription.id)} />
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
