'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClinicDocumentDto, ClinicDocumentType } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';
import { clientEnv } from '@/lib/env';
import { tokenStore } from '@/lib/token-store';

function documentsKey(clinicId: string | undefined) {
  return ['clinic', 'documents', clinicId ?? null] as const;
}

export function useClinicDocuments(clinicId: string | undefined) {
  return useQuery({
    queryKey: documentsKey(clinicId),
    queryFn: () => apiFetch<{ documents: ClinicDocumentDto[] }>(`/api/v1/clinic/documents?clinicId=${clinicId}`),
    select: (data) => data.documents,
    enabled: Boolean(clinicId),
  });
}

export function useUploadClinicDocument(clinicId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, type, expiryDate }: { file: File; type: ClinicDocumentType; expiryDate?: string }) => {
      const formData = new FormData();
      formData.append('clinicId', clinicId ?? '');
      formData.append('type', type);
      if (expiryDate) formData.append('expiryDate', expiryDate);
      formData.append('file', file);
      return apiFetch<{ document: ClinicDocumentDto }>('/api/v1/clinic/documents', { method: 'POST', body: formData });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentsKey(clinicId) }),
  });
}

export function useUpdateClinicDocumentExpiry(clinicId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, expiryDate }: { documentId: string; expiryDate: string | null }) =>
      apiFetch<{ document: ClinicDocumentDto }>(`/api/v1/clinic/documents/${documentId}/expiry`, { method: 'PATCH', body: { clinicId, expiryDate } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentsKey(clinicId) }),
  });
}

export function useDeleteClinicDocument(clinicId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => apiFetch<null>(`/api/v1/clinic/documents/${documentId}?clinicId=${clinicId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: documentsKey(clinicId) }),
  });
}

/** Downloads happen outside apiFetch (which expects a JSON envelope) — fetch the file directly
 * with the bearer token and hand the browser a blob URL to open. */
export async function downloadClinicDocument(clinicId: string, documentId: string, fileName: string) {
  const accessToken = tokenStore.get();
  const res = await fetch(`${clientEnv.apiUrl}/api/v1/clinic/documents/${documentId}/download?clinicId=${clinicId}`, {
    credentials: 'include',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!res.ok) throw new Error('Could not download document');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
