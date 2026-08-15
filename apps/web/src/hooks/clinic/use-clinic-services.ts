'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClinicServiceDto, ServiceCreateInput, ServiceUpdateInput } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

function key(clinicId: string | undefined) {
  return ['clinic', 'services', clinicId ?? null] as const;
}

export function useClinicServices(clinicId: string | undefined) {
  return useQuery({
    queryKey: key(clinicId),
    queryFn: () => apiFetch<{ services: ClinicServiceDto[] }>(`/api/v1/clinic/services?clinicId=${clinicId}`),
    select: (data) => data.services,
    enabled: Boolean(clinicId),
  });
}

export function useCreateService(clinicId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<ServiceCreateInput, 'clinicId'>) =>
      apiFetch<{ service: ClinicServiceDto }>('/api/v1/clinic/services', { method: 'POST', body: { clinicId, ...input } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(clinicId) }),
  });
}

export function useUpdateService(clinicId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ServiceUpdateInput }) =>
      apiFetch<{ service: ClinicServiceDto }>(`/api/v1/clinic/services/${id}?clinicId=${clinicId}`, { method: 'PATCH', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(clinicId) }),
  });
}

export function useDeleteService(clinicId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/api/v1/clinic/services/${id}?clinicId=${clinicId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(clinicId) }),
  });
}
