'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DoctorManualStatus, DoctorSessionDto } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

const STATUS_KEY = ['doctor', 'status'] as const;

export function useDoctorStatus() {
  return useQuery({
    queryKey: STATUS_KEY,
    queryFn: () => apiFetch<{ sessions: DoctorSessionDto[] }>('/api/v1/doctor/status'),
    select: (data) => data.sessions,
    refetchInterval: 30_000,
  });
}

export function useUpdateDoctorStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { clinicId: string; status: DoctorManualStatus }) =>
      apiFetch<{ session: DoctorSessionDto }>('/api/v1/doctor/status', { method: 'PATCH', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STATUS_KEY });
      queryClient.invalidateQueries({ queryKey: ['doctor', 'dashboard'] });
    },
  });
}
