'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClinicResourceDto, ResourceCreateInput, ResourceUpdateInput } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

function key(clinicId: string | undefined) {
  return ['clinic', 'resources', clinicId ?? null] as const;
}

export function useClinicResources(clinicId: string | undefined) {
  return useQuery({
    queryKey: key(clinicId),
    queryFn: () => apiFetch<{ resources: ClinicResourceDto[] }>(`/api/v1/clinic/resources?clinicId=${clinicId}`),
    select: (data) => data.resources,
    enabled: Boolean(clinicId),
  });
}

export function useCreateResource(clinicId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<ResourceCreateInput, 'clinicId'>) =>
      apiFetch<{ resource: ClinicResourceDto }>('/api/v1/clinic/resources', { method: 'POST', body: { clinicId, ...input } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(clinicId) }),
  });
}

export function useUpdateResource(clinicId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ResourceUpdateInput }) =>
      apiFetch<{ resource: ClinicResourceDto }>(`/api/v1/clinic/resources/${id}?clinicId=${clinicId}`, { method: 'PATCH', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(clinicId) }),
  });
}

export function useDeleteResource(clinicId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/api/v1/clinic/resources/${id}?clinicId=${clinicId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(clinicId) }),
  });
}
