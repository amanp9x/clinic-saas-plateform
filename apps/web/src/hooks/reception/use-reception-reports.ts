'use client';

import { useQuery } from '@tanstack/react-query';
import type { QueueHistoryEventDto, PaginatedResult, ReceptionReportsDto } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

export function useReceptionReports(clinicId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: ['reception', 'reports', clinicId ?? null, from, to] as const,
    queryFn: () => apiFetch<{ report: ReceptionReportsDto }>(`/api/v1/reception/reports?clinicId=${clinicId}&from=${from}&to=${to}`),
    select: (data) => data.report,
    enabled: Boolean(clinicId && from && to),
  });
}

export function useReceptionQueueHistory(clinicId: string | undefined, date?: string) {
  return useQuery({
    queryKey: ['reception', 'queue', 'history', clinicId ?? null, date ?? null] as const,
    queryFn: () =>
      apiFetch<{ history: PaginatedResult<QueueHistoryEventDto> }>(
        `/api/v1/reception/queue/history?clinicId=${clinicId}${date ? `&date=${date}` : ''}&limit=50`,
      ),
    select: (data) => data.history,
    enabled: Boolean(clinicId),
  });
}
