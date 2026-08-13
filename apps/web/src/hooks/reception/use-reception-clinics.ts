'use client';

import { useQuery } from '@tanstack/react-query';
import type { ClinicStaffProfileDto } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

export function useReceptionClinics() {
  return useQuery({
    queryKey: ['reception', 'clinics'] as const,
    queryFn: () => apiFetch<{ clinics: ClinicStaffProfileDto[] }>('/api/v1/reception/clinics'),
    select: (data) => data.clinics.filter((c) => c.isActive),
  });
}
