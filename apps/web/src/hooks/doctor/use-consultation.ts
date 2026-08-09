'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConsultationDto, ConsultationUpsertInput } from '@clinic/shared';
import { apiFetch, ApiError } from '@/lib/api-client';

function consultationKey(appointmentId: string | undefined) {
  return ['doctor', 'consultations', appointmentId] as const;
}

export function useConsultation(appointmentId: string | undefined) {
  return useQuery({
    queryKey: consultationKey(appointmentId),
    queryFn: () => apiFetch<{ consultation: ConsultationDto }>(`/api/v1/doctor/consultations/${appointmentId}`),
    select: (data) => data.consultation,
    enabled: Boolean(appointmentId),
    retry: (failureCount, error) => (error instanceof ApiError && error.status === 404 ? false : failureCount < 2),
  });
}

export function useSaveConsultation(appointmentId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ConsultationUpsertInput) =>
      apiFetch<{ consultation: ConsultationDto }>(`/api/v1/doctor/consultations/${appointmentId}`, {
        method: 'PUT',
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: consultationKey(appointmentId) }),
  });
}

export function useCompleteConsultation(appointmentId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ consultation: ConsultationDto }>(`/api/v1/doctor/consultations/${appointmentId}/complete`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: consultationKey(appointmentId) });
      queryClient.invalidateQueries({ queryKey: ['doctor', 'appointments'] });
      queryClient.invalidateQueries({ queryKey: ['doctor', 'dashboard'] });
    },
  });
}
