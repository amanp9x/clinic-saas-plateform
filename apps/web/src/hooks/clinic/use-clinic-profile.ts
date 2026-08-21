'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClinicOperatingStatus, ClinicProfileDto } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

function profileKey(clinicId: string | undefined) {
  return ['clinic', 'profile', clinicId ?? null] as const;
}

export function useClinicProfile(clinicId: string | undefined) {
  return useQuery({
    queryKey: profileKey(clinicId),
    queryFn: () => apiFetch<{ clinic: ClinicProfileDto }>(`/api/v1/clinic/profile?clinicId=${clinicId}`),
    select: (data) => data.clinic,
    enabled: Boolean(clinicId),
  });
}

export function useUpdateClinicProfile(clinicId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ClinicProfileDto>) =>
      apiFetch<{ clinic: ClinicProfileDto }>('/api/v1/clinic/profile', { method: 'PATCH', body: { clinicId, ...input } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKey(clinicId) }),
  });
}

export function useSubmitClinicVerification(clinicId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notes?: string) => apiFetch<{ clinic: ClinicProfileDto }>('/api/v1/clinic/verification', { method: 'POST', body: { clinicId, notes } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKey(clinicId) }),
  });
}

export function useUpdateClinicStatus(clinicId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ status, reason }: { status: ClinicOperatingStatus; reason?: string }) =>
      apiFetch<{ clinic: ClinicProfileDto; cancelledAppointmentCount: number }>('/api/v1/clinic/status', {
        method: 'PATCH',
        body: { clinicId, status, reason },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKey(clinicId) });
      queryClient.invalidateQueries({ queryKey: ['clinic', 'dashboard'] });
    },
  });
}
