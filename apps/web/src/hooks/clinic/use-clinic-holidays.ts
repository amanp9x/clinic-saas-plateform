'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClinicHolidayDto, HolidayCreateInput } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

function key(clinicId: string | undefined) {
  return ['clinic', 'holidays', clinicId ?? null] as const;
}

export function useClinicHolidays(clinicId: string | undefined) {
  return useQuery({
    queryKey: key(clinicId),
    queryFn: () => apiFetch<{ holidays: ClinicHolidayDto[] }>(`/api/v1/clinic/holidays?clinicId=${clinicId}`),
    select: (data) => data.holidays,
    enabled: Boolean(clinicId),
  });
}

export function useCreateHoliday(clinicId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<HolidayCreateInput, 'clinicId'>) =>
      apiFetch<{ holiday: ClinicHolidayDto }>('/api/v1/clinic/holidays', { method: 'POST', body: { clinicId, ...input } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(clinicId) }),
  });
}

export function useDeleteHoliday(clinicId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/api/v1/clinic/holidays/${id}?clinicId=${clinicId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(clinicId) }),
  });
}
