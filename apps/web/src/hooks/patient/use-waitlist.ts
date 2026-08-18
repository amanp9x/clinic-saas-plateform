'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConsultationType, PaginatedResult, WaitlistEntryDto, WaitlistStatusValue } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

const WAITLIST_KEY = ['patient', 'waitlist'] as const;

export function useMyWaitlist(status?: WaitlistStatusValue, page = 1, limit = 20) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  params.set('page', String(page));
  params.set('limit', String(limit));

  return useQuery({
    queryKey: [...WAITLIST_KEY, status ?? null, page, limit] as const,
    queryFn: () => apiFetch<PaginatedResult<WaitlistEntryDto>>(`/api/v1/waitlist/my?${params.toString()}`),
  });
}

export interface JoinWaitlistPayload {
  doctorId: string;
  clinicId: string;
  targetDate: string;
  consultationType?: ConsultationType;
  notes?: string;
}

export function useJoinWaitlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: JoinWaitlistPayload) => apiFetch<{ entry: WaitlistEntryDto }>('/api/v1/waitlist', { method: 'POST', body: payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WAITLIST_KEY }),
  });
}

export function useCancelWaitlistEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/api/v1/waitlist/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WAITLIST_KEY }),
  });
}
