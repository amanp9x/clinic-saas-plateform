'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DoctorScheduleSlotDto, ScheduleSlotCreateInput } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

const SCHEDULE_KEY = ['doctor', 'schedule'] as const;

export function useDoctorSchedule() {
  return useQuery({
    queryKey: SCHEDULE_KEY,
    queryFn: () => apiFetch<{ slots: DoctorScheduleSlotDto[] }>('/api/v1/doctor/schedule'),
    select: (data) => data.slots,
  });
}

export function useCreateScheduleSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ScheduleSlotCreateInput) =>
      apiFetch<{ slot: DoctorScheduleSlotDto }>('/api/v1/doctor/schedule', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SCHEDULE_KEY }),
  });
}

export function useUpdateScheduleSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: ScheduleSlotCreateInput & { id: string }) =>
      apiFetch<{ slot: DoctorScheduleSlotDto }>(`/api/v1/doctor/schedule/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SCHEDULE_KEY }),
  });
}

export function useDeleteScheduleSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/api/v1/doctor/schedule/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SCHEDULE_KEY }),
  });
}
