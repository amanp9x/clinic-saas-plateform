'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ClinicDoctorAssociateInput,
  ClinicDoctorDetailDto,
  ClinicDoctorStatus,
  ClinicDoctorSummaryDto,
  ClinicDoctorUpdateInput,
  ExistingDoctorSearchResultDto,
  PaginatedResult,
} from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

const DOCTORS_KEY = ['clinic', 'doctors'] as const;

export function useClinicDoctors(clinicId: string | undefined, q?: string) {
  return useQuery({
    queryKey: [...DOCTORS_KEY, clinicId ?? null, q ?? null],
    queryFn: () =>
      apiFetch<{ doctors: PaginatedResult<ClinicDoctorSummaryDto> }>(
        `/api/v1/clinic/doctors?clinicId=${clinicId}${q ? `&q=${encodeURIComponent(q)}` : ''}&limit=100`,
      ),
    select: (data) => data.doctors,
    enabled: Boolean(clinicId),
  });
}

export function useClinicDoctorDetail(clinicId: string | undefined, clinicDoctorId: string | undefined) {
  return useQuery({
    queryKey: [...DOCTORS_KEY, clinicId ?? null, clinicDoctorId ?? null],
    queryFn: () => apiFetch<{ doctor: ClinicDoctorDetailDto }>(`/api/v1/clinic/doctors/${clinicDoctorId}?clinicId=${clinicId}`),
    select: (data) => data.doctor,
    enabled: Boolean(clinicId && clinicDoctorId),
  });
}

export function useSearchExistingDoctors(clinicId: string | undefined, q: string) {
  return useQuery({
    queryKey: ['clinic', 'doctors', 'search', clinicId ?? null, q] as const,
    queryFn: () => apiFetch<{ doctors: ExistingDoctorSearchResultDto[] }>(`/api/v1/clinic/doctors/search?clinicId=${clinicId}&q=${encodeURIComponent(q)}`),
    select: (data) => data.doctors,
    enabled: Boolean(clinicId) && q.trim().length > 0,
  });
}

function useInvalidateDoctors() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: DOCTORS_KEY });
}

export function useAssociateDoctor(clinicId: string | undefined) {
  const invalidate = useInvalidateDoctors();
  return useMutation({
    mutationFn: (input: Omit<ClinicDoctorAssociateInput, 'clinicId'>) =>
      apiFetch<{ doctor: ClinicDoctorDetailDto }>('/api/v1/clinic/doctors', { method: 'POST', body: { clinicId, ...input } }),
    onSuccess: invalidate,
  });
}

export function useUpdateClinicDoctor(clinicId: string | undefined) {
  const invalidate = useInvalidateDoctors();
  return useMutation({
    mutationFn: ({ clinicDoctorId, input }: { clinicDoctorId: string; input: ClinicDoctorUpdateInput }) =>
      apiFetch<{ doctor: ClinicDoctorDetailDto }>(`/api/v1/clinic/doctors/${clinicDoctorId}?clinicId=${clinicId}`, { method: 'PATCH', body: input }),
    onSuccess: invalidate,
  });
}

export function useUpdateClinicDoctorStatus(clinicId: string | undefined) {
  const invalidate = useInvalidateDoctors();
  return useMutation({
    mutationFn: ({ clinicDoctorId, status }: { clinicDoctorId: string; status: ClinicDoctorStatus }) =>
      apiFetch<{ doctor: ClinicDoctorDetailDto }>(`/api/v1/clinic/doctors/${clinicDoctorId}/status?clinicId=${clinicId}`, { method: 'PATCH', body: { status } }),
    onSuccess: invalidate,
  });
}

export function useRemoveClinicDoctor(clinicId: string | undefined) {
  const invalidate = useInvalidateDoctors();
  return useMutation({
    mutationFn: (clinicDoctorId: string) => apiFetch<null>(`/api/v1/clinic/doctors/${clinicDoctorId}?clinicId=${clinicId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
