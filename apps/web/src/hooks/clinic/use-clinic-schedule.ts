'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClinicWorkingHoursDto, WorkingHoursUpdateInput } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

function key(clinicId: string | undefined) {
  return ['clinic', 'schedule', clinicId ?? null] as const;
}

export function useClinicWorkingHours(clinicId: string | undefined) {
  return useQuery({
    queryKey: key(clinicId),
    queryFn: () => apiFetch<{ workingHours: ClinicWorkingHoursDto[] }>(`/api/v1/clinic/schedule?clinicId=${clinicId}`),
    select: (data) => data.workingHours,
    enabled: Boolean(clinicId),
  });
}

export function useUpsertWorkingHours(clinicId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<WorkingHoursUpdateInput, 'clinicId'>) =>
      apiFetch<{ workingHours: ClinicWorkingHoursDto }>('/api/v1/clinic/schedule', { method: 'PUT', body: { clinicId, ...input } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(clinicId) }),
  });
}
