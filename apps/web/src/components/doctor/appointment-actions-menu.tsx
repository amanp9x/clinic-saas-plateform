'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MoreHorizontal } from 'lucide-react';
import type { DoctorAppointmentSummaryDto } from '@clinic/shared';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMarkNoShow, useSkipAppointment, useStartConsultation } from '@/hooks/doctor/use-doctor-appointments';
import { ApiError } from '@/lib/api-client';

const ACTIONABLE_STATUSES = new Set(['CONFIRMED', 'CHECKED_IN']);

export function AppointmentActionsMenu({ appointment }: { appointment: DoctorAppointmentSummaryDto }) {
  const router = useRouter();
  const startConsultation = useStartConsultation();
  const markNoShow = useMarkNoShow();
  const skip = useSkipAppointment();

  const canAct = ACTIONABLE_STATUSES.has(appointment.status);

  function handleStart() {
    startConsultation.mutate(appointment.id, {
      onSuccess: () => router.push(`/doctor/consultations/${appointment.id}`),
      onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not start consultation'),
    });
  }

  function handleNoShow() {
    markNoShow.mutate(appointment.id, {
      onSuccess: () => toast.success('Marked as no-show'),
      onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update appointment'),
    });
  }

  function handleSkip() {
    skip.mutate(
      { appointmentId: appointment.id },
      {
        onSuccess: () => toast.success('Patient skipped'),
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'This appointment is not in a live queue'),
      },
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canAct && (
          <DropdownMenuItem onClick={handleStart} disabled={startConsultation.isPending}>
            Start consultation
          </DropdownMenuItem>
        )}
        {canAct && (
          <DropdownMenuItem onClick={handleSkip} disabled={skip.isPending}>
            Skip patient
          </DropdownMenuItem>
        )}
        {canAct && (
          <DropdownMenuItem onClick={handleNoShow} disabled={markNoShow.isPending} variant="destructive">
            Mark no-show
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={`/doctor/patients/${appointment.patientId}`} />}>
          View patient profile
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={`/doctor/patients/${appointment.patientId}/history`} />}>
          View medical history
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={`/doctor/appointments/${appointment.id}`} />}>
          View appointment details
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
