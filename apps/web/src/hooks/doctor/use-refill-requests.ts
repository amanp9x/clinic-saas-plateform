'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResult, RefillRequestDto, RefillRequestRespondInput, RefillRequestStatus } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

const REFILL_REQUESTS_KEY = ['doctor', 'refill-requests'] as const;

export function useDoctorRefillRequests(status?: RefillRequestStatus) {
  const params = new URLSearchParams({ limit: '50' });
  if (status) params.set('status', status);

  return useQuery({
    queryKey: [...REFILL_REQUESTS_KEY, status ?? 'ALL'],
    queryFn: () => apiFetch<PaginatedResult<RefillRequestDto>>(`/api/v1/doctor/refill-requests?${params.toString()}`),
  });
}

export function useRespondToRefillRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: RefillRequestRespondInput & { id: string }) =>
      apiFetch<{ request: RefillRequestDto }>(`/api/v1/doctor/refill-requests/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REFILL_REQUESTS_KEY }),
  });
}
