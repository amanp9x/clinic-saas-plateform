'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClinicWaitlistRowDto, ConsultationType, Gender, PaginatedResult, WaitlistStatusValue } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

const WAITLIST_KEY = ['reception', 'waitlist'] as const;

export interface ReceptionWaitlistFilters {
  doctorId?: string;
  status?: WaitlistStatusValue;
  page?: number;
  limit?: number;
}

export function useClinicWaitlist(clinicId: string | undefined, filters: ReceptionWaitlistFilters) {
  const params = new URLSearchParams();
  if (clinicId) params.set('clinicId', clinicId);
  if (filters.doctorId) params.set('doctorId', filters.doctorId);
  if (filters.status) params.set('status', filters.status);
  params.set('page', String(filters.page ?? 1));
  params.set('limit', String(filters.limit ?? 25));

  return useQuery({
    queryKey: [...WAITLIST_KEY, clinicId ?? null, filters] as const,
    queryFn: () => apiFetch<PaginatedResult<ClinicWaitlistRowDto>>(`/api/v1/clinic/waitlist?${params.toString()}`),
    enabled: Boolean(clinicId),
    refetchInterval: 30_000,
  });
}

export interface AddToWaitlistPayload {
  clinicId: string;
  doctorId: string;
  targetDate: string;
  consultationType?: ConsultationType;
  notes?: string;
  patientId?: string;
  newPatient?: { fullName: string; phone: string; age?: number; gender?: Gender };
}

export function useAddToWaitlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AddToWaitlistPayload) => apiFetch<{ entry: ClinicWaitlistRowDto }>('/api/v1/clinic/waitlist', { method: 'POST', body: payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WAITLIST_KEY }),
  });
}

export function useCancelClinicWaitlistEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, clinicId }: { id: string; clinicId: string }) =>
      apiFetch<null>(`/api/v1/clinic/waitlist/${id}?clinicId=${clinicId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WAITLIST_KEY }),
  });
}
