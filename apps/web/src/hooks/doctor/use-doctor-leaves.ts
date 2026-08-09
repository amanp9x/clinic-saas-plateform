'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DoctorLeaveDto, LeaveCreateInput } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

const LEAVES_KEY = ['doctor', 'leaves'] as const;

export function useDoctorLeaves() {
  return useQuery({
    queryKey: LEAVES_KEY,
    queryFn: () => apiFetch<{ leaves: DoctorLeaveDto[] }>('/api/v1/doctor/leaves'),
    select: (data) => data.leaves,
  });
}

export function useCreateLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LeaveCreateInput) =>
      apiFetch<{ leave: DoctorLeaveDto }>('/api/v1/doctor/leaves', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LEAVES_KEY }),
  });
}

export function useDeleteLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/api/v1/doctor/leaves/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LEAVES_KEY }),
  });
}
