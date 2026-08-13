'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DoctorSessionStatus, ReceptionDoctorQueueStatusDto } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

function statusKey(clinicId: string | undefined) {
  return ['reception', 'doctors', 'status', clinicId ?? null] as const;
}

export function useReceptionDoctorStatuses(clinicId: string | undefined) {
  return useQuery({
    queryKey: statusKey(clinicId),
    queryFn: () => apiFetch<{ doctors: ReceptionDoctorQueueStatusDto[] }>(`/api/v1/reception/doctors/status?clinicId=${clinicId}`),
    select: (data) => data.doctors,
    enabled: Boolean(clinicId),
    refetchInterval: 20_000,
  });
}

export function useReceptionUpdateDoctorStatus(clinicId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ doctorId, status }: { doctorId: string; status: DoctorSessionStatus }) =>
      apiFetch<{ doctor: ReceptionDoctorQueueStatusDto }>(`/api/v1/reception/doctors/${doctorId}/status`, {
        method: 'PATCH',
        body: { clinicId, status },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: statusKey(clinicId) });
      queryClient.invalidateQueries({ queryKey: ['reception', 'dashboard'] });
    },
  });
}
