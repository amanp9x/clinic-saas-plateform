'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AddressInput,
  ChangeEmailConfirmInput,
  ChangeMobileConfirmInput,
  DeleteAccountInput,
  PatientAddressDto,
  PatientProfileDto,
  UpdateProfileInput,
} from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

const PROFILE_KEY = ['patient', 'profile'] as const;

export function usePatientProfile() {
  return useQuery({
    queryKey: PROFILE_KEY,
    queryFn: () => apiFetch<{ profile: PatientProfileDto }>('/api/v1/patient/profile'),
    select: (data) => data.profile,
  });
}

function useInvalidateProfile() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
}

export function useUpdateProfile() {
  const invalidate = useInvalidateProfile();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      apiFetch<{ profile: PatientProfileDto }>('/api/v1/patient/profile', {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: invalidate,
  });
}

export function useUploadProfilePhoto() {
  const invalidate = useInvalidateProfile();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('photo', file);
      return apiFetch<{ profileImageUrl: string }>('/api/v1/patient/profile/photo', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: invalidate,
  });
}

export function useRemoveProfilePhoto() {
  const invalidate = useInvalidateProfile();
  return useMutation({
    mutationFn: () => apiFetch<null>('/api/v1/patient/profile/photo', { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useCreateAddress() {
  const invalidate = useInvalidateProfile();
  return useMutation({
    mutationFn: (input: AddressInput) =>
      apiFetch<{ address: PatientAddressDto }>('/api/v1/patient/addresses', {
        method: 'POST',
        body: input,
      }),
    onSuccess: invalidate,
  });
}

export function useUpdateAddress() {
  const invalidate = useInvalidateProfile();
  return useMutation({
    mutationFn: ({ id, ...input }: AddressInput & { id: string }) =>
      apiFetch<{ address: PatientAddressDto }>(`/api/v1/patient/addresses/${id}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: invalidate,
  });
}

export function useDeleteAddress() {
  const invalidate = useInvalidateProfile();
  return useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/api/v1/patient/addresses/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useRequestEmailChange() {
  return useMutation({
    mutationFn: (newEmail: string) =>
      apiFetch<null>('/api/v1/patient/email/change/request', { method: 'POST', body: { newEmail } }),
  });
}

export function useConfirmEmailChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ChangeEmailConfirmInput) =>
      apiFetch<null>('/api/v1/patient/email/change/confirm', { method: 'POST', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export function useRequestMobileChange() {
  return useMutation({
    mutationFn: (newPhone: string) =>
      apiFetch<null>('/api/v1/patient/mobile/change/request', { method: 'POST', body: { newPhone } }),
  });
}

export function useConfirmMobileChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ChangeMobileConfirmInput) =>
      apiFetch<null>('/api/v1/patient/mobile/change/confirm', { method: 'POST', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: (input: DeleteAccountInput) =>
      apiFetch<null>('/api/v1/patient/account', { method: 'DELETE', body: input }),
  });
}
