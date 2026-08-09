'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DoctorProfileDto, DoctorProfileUpdateInput } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

const PROFILE_KEY = ['doctor', 'profile'] as const;

export function useDoctorProfile() {
  return useQuery({
    queryKey: PROFILE_KEY,
    queryFn: () => apiFetch<{ profile: DoctorProfileDto }>('/api/v1/doctor/profile'),
    select: (data) => data.profile,
  });
}

export function useUpdateDoctorProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DoctorProfileUpdateInput) =>
      apiFetch<{ profile: DoctorProfileDto }>('/api/v1/doctor/profile', { method: 'PATCH', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROFILE_KEY }),
  });
}

export function useUploadDoctorPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('photo', file);
      return apiFetch<{ profileImageUrl: string }>('/api/v1/doctor/profile/photo', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROFILE_KEY }),
  });
}

export function useRemoveDoctorPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<null>('/api/v1/doctor/profile/photo', { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROFILE_KEY }),
  });
}
