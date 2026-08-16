'use client';

import { useQuery } from '@tanstack/react-query';
import type { ClinicBillingRowDto, ClinicBillingSummaryDto, PaginatedResult } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

export interface ClinicBillingFilters {
  from?: string;
  to?: string;
  doctorId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export function useClinicBilling(clinicId: string | undefined, filters: ClinicBillingFilters) {
  const params = new URLSearchParams({ clinicId: clinicId ?? '' });
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.doctorId) params.set('doctorId', filters.doctorId);
  if (filters.status) params.set('status', filters.status);
  params.set('page', String(filters.page ?? 1));
  params.set('limit', String(filters.limit ?? 20));

  return useQuery({
    queryKey: ['clinic', 'billing', clinicId ?? null, filters] as const,
    queryFn: () =>
      apiFetch<{ summary: ClinicBillingSummaryDto; items: PaginatedResult<ClinicBillingRowDto> }>(`/api/v1/clinic/billing?${params.toString()}`),
    enabled: Boolean(clinicId),
  });
}
