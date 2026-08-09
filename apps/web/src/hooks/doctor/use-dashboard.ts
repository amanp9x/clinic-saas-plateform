'use client';

import { useQuery } from '@tanstack/react-query';
import type { DoctorDashboardSummaryDto } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

export function useDoctorDashboard() {
  return useQuery({
    queryKey: ['doctor', 'dashboard'],
    queryFn: () => apiFetch<{ summary: DoctorDashboardSummaryDto }>('/api/v1/doctor/dashboard'),
    select: (data) => data.summary,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
