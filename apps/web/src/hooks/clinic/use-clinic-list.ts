'use client';

import { useQuery } from '@tanstack/react-query';
import type { ClinicStaffProfileDto } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

/** Reuses the Reception Portal's "which clinics am I staff at" endpoint — CLINIC_ADMIN is one
 * of the roles it already serves (see reception.routes.ts), so no duplicate endpoint is needed. */
export function useClinicList() {
  return useQuery({
    queryKey: ['clinic', 'my-clinics'] as const,
    queryFn: () => apiFetch<{ clinics: ClinicStaffProfileDto[] }>('/api/v1/reception/clinics'),
    select: (data) => data.clinics.filter((c) => c.isActive),
  });
}
