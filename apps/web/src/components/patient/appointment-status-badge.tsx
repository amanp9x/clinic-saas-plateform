import { Badge } from '@/components/ui/badge';
import type { AppointmentStatus } from '@clinic/shared';

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING: { label: 'Pending', variant: 'outline' },
  CONFIRMED: { label: 'Confirmed', variant: 'secondary' },
  CHECKED_IN: { label: 'Checked in', variant: 'default' },
  IN_CONSULTATION: { label: 'In consultation', variant: 'default' },
  COMPLETED: { label: 'Completed', variant: 'secondary' },
  CANCELLED: { label: 'Cancelled', variant: 'destructive' },
  NO_SHOW: { label: 'No-show', variant: 'destructive' },
};

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
