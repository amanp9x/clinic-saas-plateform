'use client';

import { useQuery } from '@tanstack/react-query';
import type { ClinicDashboardSummaryDto } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

export function useClinicDashboard(clinicId: string | undefined) {
  return useQuery({
    queryKey: ['clinic', 'dashboard', clinicId ?? null] as const,
    queryFn: () => apiFetch<{ summary: ClinicDashboardSummaryDto }>(`/api/v1/clinic/dashboard?clinicId=${clinicId}`),
    select: (data) => data.summary,
    enabled: Boolean(clinicId),
    refetchInterval: 20_000,
  });
}
