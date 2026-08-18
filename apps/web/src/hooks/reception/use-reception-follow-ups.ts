'use client';

import { useQuery } from '@tanstack/react-query';
import type { FollowUpRowDto, PaginatedResult } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

export interface ReceptionFollowUpFilters {
  doctorId?: string;
  page?: number;
  limit?: number;
}

export function useClinicFollowUps(clinicId: string | undefined, filters: ReceptionFollowUpFilters) {
  const params = new URLSearchParams();
  if (clinicId) params.set('clinicId', clinicId);
  if (filters.doctorId) params.set('doctorId', filters.doctorId);
  params.set('page', String(filters.page ?? 1));
  params.set('limit', String(filters.limit ?? 25));

  return useQuery({
    queryKey: ['reception', 'follow-ups', clinicId ?? null, filters] as const,
    queryFn: () => apiFetch<PaginatedResult<FollowUpRowDto>>(`/api/v1/clinic/follow-ups?${params.toString()}`),
    enabled: Boolean(clinicId),
    refetchInterval: 60_000,
  });
}
