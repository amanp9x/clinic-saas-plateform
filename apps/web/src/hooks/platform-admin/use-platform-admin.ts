'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ClinicVerificationStatus,
  ComplianceDocumentRowDto,
  PaginatedResult,
  PlatformClinicDetailDto,
  PlatformClinicRowDto,
  PlatformOverviewDto,
} from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

const PLATFORM_KEY = ['platform-admin'] as const;

export function usePlatformOverview() {
  return useQuery({
    queryKey: [...PLATFORM_KEY, 'overview'] as const,
    queryFn: () => apiFetch<{ overview: PlatformOverviewDto }>('/api/v1/platform-admin/overview'),
    select: (data) => data.overview,
  });
}

export interface PlatformClinicFilters {
  verificationStatus?: ClinicVerificationStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export function usePlatformClinics(filters: PlatformClinicFilters) {
  const params = new URLSearchParams();
  if (filters.verificationStatus) params.set('verificationStatus', filters.verificationStatus);
  if (filters.search) params.set('search', filters.search);
  params.set('page', String(filters.page ?? 1));
  params.set('limit', String(filters.limit ?? 25));

  return useQuery({
    queryKey: [...PLATFORM_KEY, 'clinics', filters] as const,
    queryFn: () => apiFetch<PaginatedResult<PlatformClinicRowDto>>(`/api/v1/platform-admin/clinics?${params.toString()}`),
  });
}

export function usePlatformClinicDetail(id: string | undefined) {
  return useQuery({
    queryKey: [...PLATFORM_KEY, 'clinics', id] as const,
    queryFn: () => apiFetch<{ clinic: PlatformClinicDetailDto }>(`/api/v1/platform-admin/clinics/${id}`),
    select: (data) => data.clinic,
    enabled: Boolean(id),
  });
}

export function useUpdateClinicVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: ClinicVerificationStatus; notes?: string }) =>
      apiFetch<{ clinic: PlatformClinicDetailDto }>(`/api/v1/platform-admin/clinics/${id}/verification`, { method: 'PATCH', body: { status, notes } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PLATFORM_KEY }),
  });
}

export interface ComplianceDocumentFilters {
  status?: 'EXPIRING_SOON' | 'EXPIRED';
  page?: number;
  limit?: number;
}

export function usePlatformComplianceDocuments(filters: ComplianceDocumentFilters) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  params.set('page', String(filters.page ?? 1));
  params.set('limit', String(filters.limit ?? 25));

  return useQuery({
    queryKey: [...PLATFORM_KEY, 'compliance', filters] as const,
    queryFn: () => apiFetch<PaginatedResult<ComplianceDocumentRowDto>>(`/api/v1/platform-admin/compliance/documents?${params.toString()}`),
  });
}

export function useUpdateClinicDocumentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clinicId, documentId, status, notes }: { clinicId: string; documentId: string; status: 'VERIFIED' | 'REJECTED'; notes?: string }) =>
      apiFetch<{ clinic: PlatformClinicDetailDto }>(`/api/v1/platform-admin/clinics/${clinicId}/documents/${documentId}`, { method: 'PATCH', body: { status, notes } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PLATFORM_KEY }),
  });
}
