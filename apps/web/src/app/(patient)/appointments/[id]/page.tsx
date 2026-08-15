'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarClock, MapPin, Phone, Receipt } from 'lucide-react';
import { useAppointment } from '@/hooks/patient/use-appointments';
import { AppointmentStatusBadge } from '@/components/patient/appointment-status-badge';
import { CancelAppointmentDialog } from '@/components/patient/cancel-appointment-dialog';
import { RescheduleAppointmentDialog } from '@/components/patient/reschedule-appointment-dialog';
import { EmptyState } from '@/components/marketing/empty-state';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, formatFee, initials } from '@/lib/format';

const CANCELLABLE_STATUSES = new Set(['PENDING', 'CONFIRMED']);

export default function AppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: appointment, isLoading } = useAppointment(id);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState title="Appointment not found" description="This appointment may have been removed." />
      </div>
    );
  }

  const canCancel = CANCELLABLE_STATUSES.has(appointment.status);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/appointments/upcoming"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-medium"
      >
        <ArrowLeft className="size-4" />
        Back to appointments
      </Link>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar className="size-14">
                {appointment.doctorProfileImageUrl && (
                  <AvatarImage src={appointment.doctorProfileImageUrl} alt={appointment.doctorName} />
                )}
                <AvatarFallback>{initials(appointment.doctorName)}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg">{appointment.doctorName}</CardTitle>
                <p className="text-muted-foreground text-sm">
                  {appointment.specializationName ?? 'General Practice'}
                </p>
              </div>
            </div>
            <AppointmentStatusBadge status={appointment.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <CalendarClock className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <div>
                <p className="text-sm font-medium">{formatDateTime(appointment.scheduledAt)}</p>
                {appointment.tokenNumber && (
                  <p className="text-muted-foreground text-xs">Token #{appointment.tokenNumber}</p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <div>
                <p className="text-sm font-medium">{appointment.clinicName}</p>
                <p className="text-muted-foreground text-xs">
                  {appointment.clinicAddress ?? appointment.clinicCity ?? 'Address not listed'}
                </p>
              </div>
            </div>
            {appointment.clinicPhone && (
              <div className="flex items-start gap-2">
                <Phone className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <p className="text-sm">{appointment.clinicPhone}</p>
              </div>
            )}
            <div className="flex items-start gap-2">
              <Receipt className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <p className="text-sm">{formatFee(appointment.consultationFee)}</p>
            </div>
          </div>

          {appointment.reasonForVisit && (
            <div>
              <p className="text-sm font-medium">Reason for visit</p>
              <p className="text-muted-foreground text-sm">{appointment.reasonForVisit}</p>
            </div>
          )}

          {appointment.status === 'CANCELLED' && appointment.cancelReason && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-destructive text-sm font-medium">Cancellation reason</p>
              <p className="text-muted-foreground text-sm">{appointment.cancelReason}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t pt-4">
            {appointment.status === 'CONFIRMED' && (
              <Button render={<Link href={`/queue/${appointment.id}`} />}>Join Queue</Button>
            )}
            {appointment.hasPrescription && (
              <Button variant="outline" render={<Link href="/medical-records/prescriptions" />}>
                View Prescription
              </Button>
            )}
            {canCancel && (
              <RescheduleAppointmentDialog
                appointment={appointment}
                trigger={<Button variant="outline">Reschedule</Button>}
              />
            )}
            {canCancel && (
              <CancelAppointmentDialog
                appointmentId={appointment.id}
                trigger={<Button variant="destructive">Cancel Appointment</Button>}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
