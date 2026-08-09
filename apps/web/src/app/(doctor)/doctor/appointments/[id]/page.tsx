'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarClock, MapPin, Stethoscope, User } from 'lucide-react';
import { useDoctorAppointmentDetail, useMarkNoShow, useSkipAppointment, useStartConsultation } from '@/hooks/doctor/use-doctor-appointments';
import { AppointmentStatusBadge } from '@/components/patient/appointment-status-badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, initials } from '@/lib/format';
import { ApiError } from '@/lib/api-client';

const ACTIONABLE_STATUSES = new Set(['CONFIRMED', 'CHECKED_IN']);

export default function AppointmentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: appointment, isLoading } = useDoctorAppointmentDetail(params.id);
  const startConsultation = useStartConsultation();
  const markNoShow = useMarkNoShow();
  const skip = useSkipAppointment();

  if (isLoading || !appointment) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const canAct = ACTIONABLE_STATUSES.has(appointment.status);

  function handleStart() {
    startConsultation.mutate(appointment!.id, {
      onSuccess: () => router.push(`/doctor/consultations/${appointment!.id}`),
      onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not start consultation'),
    });
  }

  function handleNoShow() {
    markNoShow.mutate(appointment!.id, {
      onSuccess: () => toast.success('Marked as no-show'),
      onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update appointment'),
    });
  }

  function handleSkip() {
    skip.mutate(
      { appointmentId: appointment!.id },
      {
        onSuccess: () => toast.success('Patient skipped'),
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'This appointment is not in a live queue'),
      },
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold">Appointment Details</h1>
        <AppointmentStatusBadge status={appointment.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-4" />
            Patient
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="size-14">
            {appointment.patientProfileImageUrl && (
              <AvatarImage src={appointment.patientProfileImageUrl} alt={appointment.patientName} />
            )}
            <AvatarFallback>{initials(appointment.patientName)}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="font-semibold">{appointment.patientName}</p>
            <p className="text-muted-foreground text-sm">
              {appointment.patientAge != null ? `${appointment.patientAge} yrs` : 'Age not on file'}
              {appointment.patientGender ? ` · ${appointment.patientGender}` : ''}
            </p>
            {appointment.patientPhone && <p className="text-muted-foreground text-sm">{appointment.patientPhone}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="size-4" />
            Appointment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Scheduled: </span>
            {formatDateTime(appointment.scheduledAt)}
          </p>
          <p className="flex items-center gap-1">
            <MapPin className="text-muted-foreground size-3.5" />
            {appointment.clinicName}
          </p>
          <p>
            <span className="text-muted-foreground">Token: </span>
            {appointment.tokenNumber ?? '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Consultation fee: </span>
            {appointment.consultationFee ? `₹${appointment.consultationFee}` : 'Not set'}
          </p>
          {appointment.reasonForVisit && (
            <p>
              <span className="text-muted-foreground">Patient notes: </span>
              {appointment.reasonForVisit}
            </p>
          )}
          {appointment.consultationStatus && (
            <p>
              <span className="text-muted-foreground">Consultation status: </span>
              {appointment.consultationStatus.replace('_', ' ')}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="size-4" />
            Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {canAct && (
            <Button onClick={handleStart} disabled={startConsultation.isPending}>
              {appointment.consultationStatus === 'IN_PROGRESS' ? 'Continue consultation' : 'Start consultation'}
            </Button>
          )}
          {appointment.consultationStatus === 'IN_PROGRESS' && (
            <Button variant="outline" render={<Link href={`/doctor/consultations/${appointment.id}`} />}>
              Open consultation workspace
            </Button>
          )}
          {canAct && (
            <Button variant="outline" onClick={handleSkip} disabled={skip.isPending}>
              Skip patient
            </Button>
          )}
          {canAct && (
            <Button variant="outline" onClick={handleNoShow} disabled={markNoShow.isPending}>
              Mark no-show
            </Button>
          )}
          <Button variant="outline" render={<Link href={`/doctor/patients/${appointment.patientId}`} />}>
            View patient profile
          </Button>
          <Button variant="outline" render={<Link href={`/doctor/patients/${appointment.patientId}/history`} />}>
            View medical history
          </Button>
          {appointment.hasPrescription && (
            <Button variant="outline" render={<Link href={`/doctor/prescriptions?appointmentId=${appointment.id}`} />}>
              View prescription
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
