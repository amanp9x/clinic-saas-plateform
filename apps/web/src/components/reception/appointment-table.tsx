'use client';

import { toast } from 'sonner';
import Link from 'next/link';
import type { ReceptionAppointmentSummaryDto } from '@clinic/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/marketing/empty-state';
import { useReceptionCheckIn } from '@/hooks/reception/use-reception-appointments';
import { useReceptionMarkNoShowAppointment } from '@/hooks/reception/use-reception-booking';
import { ReceptionRescheduleDialog } from '@/components/reception/reception-reschedule-dialog';
import { ReceptionCancelDialog } from '@/components/reception/reception-cancel-dialog';
import { ApiError } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';

const CHECKABLE_STATUSES = new Set(['PENDING', 'CONFIRMED']);
const RESCHEDULABLE_STATUSES = new Set(['PENDING', 'CONFIRMED']);
const NO_SHOWABLE_STATUSES = new Set(['CONFIRMED', 'CHECKED_IN']);

export function AppointmentTable({ appointments }: { appointments: ReceptionAppointmentSummaryDto[] }) {
  const checkIn = useReceptionCheckIn();
  const markNoShow = useReceptionMarkNoShowAppointment();

  if (appointments.length === 0) {
    return <EmptyState title="No appointments" description="Appointments for this filter will appear here." />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Patient</TableHead>
          <TableHead>Doctor</TableHead>
          <TableHead>Scheduled</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Payment</TableHead>
          <TableHead>Token / Queue</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {appointments.map((a) => (
          <TableRow key={a.id}>
            <TableCell>
              <Link href={`/reception/patients/${a.patientId}?clinicId=${a.clinicId}`} className="font-medium hover:underline">
                {a.patientName}
              </Link>
              <p className="text-muted-foreground text-xs">{a.patientPhone ?? '—'}</p>
            </TableCell>
            <TableCell>{a.doctorName}</TableCell>
            <TableCell>{formatDateTime(a.scheduledAt)}</TableCell>
            <TableCell>
              <Badge variant="outline">{a.status.replace('_', ' ')}</Badge>
            </TableCell>
            <TableCell>
              {a.paymentStatus ? (
                <Badge variant={a.paymentStatus === 'CAPTURED' ? 'secondary' : a.paymentStatus === 'FAILED' ? 'destructive' : 'outline'}>
                  {a.paymentStatus.replace('_', ' ')}
                </Badge>
              ) : (
                <span className="text-muted-foreground text-xs">—</span>
              )}
            </TableCell>
            <TableCell>
              {a.tokenNumber ? (
                <span>
                  #{a.tokenNumber} {a.tokenStatus ? `· ${a.tokenStatus.replace('_', ' ')}` : ''}
                  {a.queuePosition !== null && a.tokenStatus === 'WAITING' ? ` · ${a.queuePosition} ahead` : ''}
                </span>
              ) : (
                <span className="text-muted-foreground">Not queued</span>
              )}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {CHECKABLE_STATUSES.has(a.status) && (
                  <Button
                    size="sm"
                    onClick={() =>
                      checkIn.mutate(a.id, {
                        onSuccess: () => toast.success(`${a.patientName} checked in`),
                        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not check in patient'),
                      })
                    }
                    disabled={checkIn.isPending}
                  >
                    Check In
                  </Button>
                )}
                {RESCHEDULABLE_STATUSES.has(a.status) && (
                  <ReceptionRescheduleDialog
                    appointment={a}
                    trigger={
                      <Button size="sm" variant="outline">
                        Reschedule
                      </Button>
                    }
                  />
                )}
                {RESCHEDULABLE_STATUSES.has(a.status) && (
                  <ReceptionCancelDialog
                    appointmentId={a.id}
                    clinicId={a.clinicId}
                    patientName={a.patientName}
                    trigger={
                      <Button size="sm" variant="outline">
                        Cancel
                      </Button>
                    }
                  />
                )}
                {NO_SHOWABLE_STATUSES.has(a.status) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      markNoShow.mutate(
                        { id: a.id, clinicId: a.clinicId },
                        {
                          onSuccess: () => toast.success(`${a.patientName} marked no-show`),
                          onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not mark no-show'),
                        },
                      )
                    }
                    disabled={markNoShow.isPending}
                  >
                    No-show
                  </Button>
                )}
                {!CHECKABLE_STATUSES.has(a.status) && !RESCHEDULABLE_STATUSES.has(a.status) && !NO_SHOWABLE_STATUSES.has(a.status) && (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
