import type { ReactNode } from 'react';
import { MapPin } from 'lucide-react';
import type { AppointmentSummaryDto } from '@clinic/shared';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { AppointmentStatusBadge } from './appointment-status-badge';
import { formatDateTime, initials } from '@/lib/format';

export function AppointmentCard({
  appointment,
  actions,
}: {
  appointment: AppointmentSummaryDto;
  actions?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Avatar className="size-12">
            {appointment.doctorProfileImageUrl && (
              <AvatarImage src={appointment.doctorProfileImageUrl} alt={appointment.doctorName} />
            )}
            <AvatarFallback>{initials(appointment.doctorName)}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{appointment.doctorName}</p>
              <AppointmentStatusBadge status={appointment.status} />
            </div>
            <p className="text-sm text-muted-foreground">{appointment.specializationName ?? 'General Practice'}</p>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-3.5" />
              {appointment.clinicName}
              {appointment.clinicCity ? `, ${appointment.clinicCity}` : ''}
            </p>
            <p className="text-sm font-medium">{formatDateTime(appointment.scheduledAt)}</p>
            {appointment.tokenNumber && (
              <p className="text-xs text-muted-foreground">Token #{appointment.tokenNumber}</p>
            )}
          </div>
        </div>

        {actions && <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">{actions}</div>}
      </CardContent>
    </Card>
  );
}
