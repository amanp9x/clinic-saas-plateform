'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DoctorSignatureDto } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

const SIGNATURE_KEY = ['doctor', 'signature'] as const;

export function useDoctorSignature() {
  return useQuery({
    queryKey: SIGNATURE_KEY,
    queryFn: () => apiFetch<{ signature: DoctorSignatureDto }>('/api/v1/doctor/settings/signature'),
    select: (data) => data.signature,
  });
}

export function useUpdateSignatureText() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (signatureText: string) =>
      apiFetch<{ signature: DoctorSignatureDto }>('/api/v1/doctor/settings/signature', {
        method: 'PUT',
        body: { signatureText },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SIGNATURE_KEY }),
  });
}

export function useUploadSignatureImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('signature', file);
      return apiFetch<{ signature: DoctorSignatureDto }>('/api/v1/doctor/settings/signature/image', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SIGNATURE_KEY }),
  });
}

export function useRemoveSignatureImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<null>('/api/v1/doctor/settings/signature/image', { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SIGNATURE_KEY }),
  });
}
