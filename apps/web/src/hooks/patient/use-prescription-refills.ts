'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResult, RefillRequestCreateInput, RefillRequestDto } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

const REFILL_REQUESTS_KEY = ['patient', 'refill-requests'] as const;

export function usePatientRefillRequests() {
  return useQuery({
    queryKey: REFILL_REQUESTS_KEY,
    queryFn: () => apiFetch<PaginatedResult<RefillRequestDto>>('/api/v1/prescriptions/refill-requests?limit=50'),
    select: (data) => data.items,
  });
}

export function useRequestRefill(prescriptionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RefillRequestCreateInput) =>
      apiFetch<{ request: RefillRequestDto }>(`/api/v1/prescriptions/${prescriptionId}/refill-requests`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REFILL_REQUESTS_KEY }),
  });
}
