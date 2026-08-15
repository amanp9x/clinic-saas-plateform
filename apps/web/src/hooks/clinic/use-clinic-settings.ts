'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClinicSettingsDto, ClinicSettingsUpdateInput } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

function key(clinicId: string | undefined) {
  return ['clinic', 'settings', clinicId ?? null] as const;
}

export function useClinicSettings(clinicId: string | undefined) {
  return useQuery({
    queryKey: key(clinicId),
    queryFn: () => apiFetch<{ settings: ClinicSettingsDto }>(`/api/v1/clinic/settings?clinicId=${clinicId}`),
    select: (data) => data.settings,
    enabled: Boolean(clinicId),
  });
}

export function useUpdateClinicSettings(clinicId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<ClinicSettingsUpdateInput, 'clinicId'>) =>
      apiFetch<{ settings: ClinicSettingsDto }>('/api/v1/clinic/settings', { method: 'PATCH', body: { clinicId, ...input } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(clinicId) }),
  });
}
