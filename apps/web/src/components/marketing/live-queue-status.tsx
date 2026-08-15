'use client';

import type { DoctorQueueStatus } from '@clinic/shared';
import { useDoctorQueueStatus } from '@/hooks/use-doctor-queue-status';
import { QueueStatusCard } from './queue-status-card';

export function LiveQueueStatus({
  doctorSlug,
  clinicId,
  initialStatus,
}: {
  doctorSlug: string;
  clinicId: string;
  initialStatus: DoctorQueueStatus;
}) {
  const status = useDoctorQueueStatus(doctorSlug, clinicId, initialStatus);
  return <QueueStatusCard status={status} />;
}
