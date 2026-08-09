'use client';

import { useQuery } from '@tanstack/react-query';
import type { DoctorEarningsSummaryDto } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

export function useDoctorEarnings(range: 'today' | 'week' | 'month') {
  return useQuery({
    queryKey: ['doctor', 'earnings', range],
    queryFn: () => apiFetch<{ earnings: DoctorEarningsSummaryDto }>(`/api/v1/doctor/earnings?range=${range}`),
    select: (data) => data.earnings,
  });
}
