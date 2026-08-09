import { Badge } from '@/components/ui/badge';
import type { DoctorSessionStatus } from '@clinic/shared';

const STATUS_CONFIG: Record<DoctorSessionStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  NOT_ARRIVED: { label: 'Not arrived', variant: 'outline' },
  ARRIVED: { label: 'Arrived', variant: 'secondary' },
  AVAILABLE: { label: 'Available', variant: 'default' },
  IN_CONSULTATION: { label: 'In consultation', variant: 'default' },
  ON_BREAK: { label: 'On break', variant: 'secondary' },
  DELAYED: { label: 'Running late', variant: 'destructive' },
  UNAVAILABLE: { label: 'Unavailable', variant: 'outline' },
  SESSION_ENDED: { label: 'Clinic closed', variant: 'outline' },
};

export function DoctorStatusBadge({ status }: { status: DoctorSessionStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
