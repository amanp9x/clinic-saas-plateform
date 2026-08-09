import type { DoctorAppointmentSummaryDto } from '@clinic/shared';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AppointmentStatusBadge } from '@/components/patient/appointment-status-badge';
import { AppointmentActionsMenu } from './appointment-actions-menu';
import { EmptyState } from '@/components/marketing/empty-state';
import { formatDateTime, initials } from '@/lib/format';
import { CalendarX2 } from 'lucide-react';

export function AppointmentListTable({ appointments }: { appointments: DoctorAppointmentSummaryDto[] }) {
  if (appointments.length === 0) {
    return (
      <EmptyState
        icon={CalendarX2}
        title="No appointments here"
        description="Appointments matching this filter will show up here."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Patient</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Token</TableHead>
          <TableHead>Clinic</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {appointments.map((appt) => (
          <TableRow key={appt.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <Avatar className="size-8">
                  {appt.patientProfileImageUrl && <AvatarImage src={appt.patientProfileImageUrl} alt={appt.patientName} />}
                  <AvatarFallback>{initials(appt.patientName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium">{appt.patientName}</p>
                  <p className="text-muted-foreground text-xs">
                    {appt.patientAge != null ? `${appt.patientAge} yrs` : ''}
                    {appt.patientAge != null && appt.patientGender ? ' · ' : ''}
                    {appt.patientGender ?? ''}
                  </p>
                </div>
              </div>
            </TableCell>
            <TableCell>{formatDateTime(appt.scheduledAt)}</TableCell>
            <TableCell>{appt.tokenNumber ?? '—'}</TableCell>
            <TableCell>{appt.clinicName}</TableCell>
            <TableCell>
              <AppointmentStatusBadge status={appt.status} />
            </TableCell>
            <TableCell className="text-right">
              <AppointmentActionsMenu appointment={appt} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
