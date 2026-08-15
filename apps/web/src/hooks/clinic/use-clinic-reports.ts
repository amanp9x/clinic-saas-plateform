'use client';

import { useQuery } from '@tanstack/react-query';
import type { ClinicReportsDto } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

export function useClinicReports(clinicId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: ['clinic', 'reports', clinicId ?? null, from, to] as const,
    queryFn: () => apiFetch<{ report: ClinicReportsDto }>(`/api/v1/clinic/reports?clinicId=${clinicId}&from=${from}&to=${to}`),
    select: (data) => data.report,
    enabled: Boolean(clinicId && from && to),
  });
}
