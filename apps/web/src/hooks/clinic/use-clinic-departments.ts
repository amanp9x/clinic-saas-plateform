'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DepartmentCreateInput, DepartmentDto, DepartmentUpdateInput } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

function key(clinicId: string | undefined) {
  return ['clinic', 'departments', clinicId ?? null] as const;
}

export function useClinicDepartments(clinicId: string | undefined) {
  return useQuery({
    queryKey: key(clinicId),
    queryFn: () => apiFetch<{ departments: DepartmentDto[] }>(`/api/v1/clinic/departments?clinicId=${clinicId}`),
    select: (data) => data.departments,
    enabled: Boolean(clinicId),
  });
}

export function useCreateDepartment(clinicId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<DepartmentCreateInput, 'clinicId'>) =>
      apiFetch<{ department: DepartmentDto }>('/api/v1/clinic/departments', { method: 'POST', body: { clinicId, ...input } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(clinicId) }),
  });
}

export function useUpdateDepartment(clinicId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: DepartmentUpdateInput }) =>
      apiFetch<{ department: DepartmentDto }>(`/api/v1/clinic/departments/${id}?clinicId=${clinicId}`, { method: 'PATCH', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(clinicId) }),
  });
}

export function useDeleteDepartment(clinicId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/api/v1/clinic/departments/${id}?clinicId=${clinicId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(clinicId) }),
  });
}
