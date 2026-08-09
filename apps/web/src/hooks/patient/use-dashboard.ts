'use client';

import { useQuery } from '@tanstack/react-query';
import type { DashboardSummaryDto } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['patient', 'dashboard-summary'],
    queryFn: () => apiFetch<{ summary: DashboardSummaryDto }>('/api/v1/dashboard/summary'),
    select: (data) => data.summary,
    staleTime: 30_000,
  });
}
