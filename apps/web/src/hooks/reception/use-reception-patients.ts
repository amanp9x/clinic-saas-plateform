'use client';

import { useQuery } from '@tanstack/react-query';
import type { PaginatedResult, PatientQuickViewDto, PatientSearchResultDto } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

export function useReceptionPatientSearch(clinicId: string | undefined, q: string) {
  return useQuery({
    queryKey: ['reception', 'patients', 'search', clinicId ?? null, q] as const,
    queryFn: () =>
      apiFetch<{ patients: PaginatedResult<PatientSearchResultDto> }>(
        `/api/v1/reception/patients/search?clinicId=${clinicId}&q=${encodeURIComponent(q)}`,
      ),
    select: (data) => data.patients,
    enabled: Boolean(clinicId) && q.trim().length > 0,
  });
}

export function useReceptionPatientQuickView(clinicId: string | undefined, patientId: string | undefined) {
  return useQuery({
    queryKey: ['reception', 'patients', clinicId ?? null, patientId ?? null] as const,
    queryFn: () => apiFetch<{ patient: PatientQuickViewDto }>(`/api/v1/reception/patients/${patientId}?clinicId=${clinicId}`),
    select: (data) => data.patient,
    enabled: Boolean(clinicId && patientId),
  });
}
