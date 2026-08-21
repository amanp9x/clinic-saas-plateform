'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResult, SettlementRequestDto, SettlementStatus } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

const PLATFORM_SETTLEMENTS_KEY = ['platform-admin', 'settlements'] as const;

export function usePlatformSettlements(status?: SettlementStatus) {
  const params = new URLSearchParams({ limit: '50' });
  if (status) params.set('status', status);

  return useQuery({
    queryKey: [...PLATFORM_SETTLEMENTS_KEY, status ?? 'ALL'],
    queryFn: () => apiFetch<PaginatedResult<SettlementRequestDto>>(`/api/v1/platform-admin/settlements?${params.toString()}`),
  });
}

export function usePlatformSettlementDetail(id: string | undefined) {
  return useQuery({
    queryKey: [...PLATFORM_SETTLEMENTS_KEY, id] as const,
    queryFn: () => apiFetch<{ settlement: SettlementRequestDto }>(`/api/v1/platform-admin/settlements/${id}`),
    select: (data) => data.settlement,
    enabled: Boolean(id),
  });
}

function useSettlementAction(action: 'approve' | 'reject' | 'mark-paid') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reviewNotes }: { id: string; reviewNotes?: string }) =>
      apiFetch<{ settlement: SettlementRequestDto }>(`/api/v1/platform-admin/settlements/${id}/${action}`, { method: 'PATCH', body: { reviewNotes } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PLATFORM_SETTLEMENTS_KEY }),
  });
}

export function useApproveSettlement() {
  return useSettlementAction('approve');
}

export function useRejectSettlement() {
  return useSettlementAction('reject');
}

export function useMarkSettlementPaid() {
  return useSettlementAction('mark-paid');
}
