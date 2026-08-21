'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResult, SettlementRequestDto } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

const DOCTOR_SETTLEMENTS_KEY = ['doctor', 'settlements'] as const;

export function useDoctorSettlements() {
  return useQuery({
    queryKey: DOCTOR_SETTLEMENTS_KEY,
    queryFn: () => apiFetch<PaginatedResult<SettlementRequestDto>>('/api/v1/doctor/settlements?limit=20'),
    select: (data) => data.items,
  });
}

export function useRequestSettlement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notes?: string) => apiFetch<{ settlement: SettlementRequestDto }>('/api/v1/doctor/settlements', { method: 'POST', body: { notes } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DOCTOR_SETTLEMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: ['doctor', 'earnings'] });
    },
  });
}
