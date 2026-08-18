'use client';

import { useQuery } from '@tanstack/react-query';
import type { DoctorWaitlistRowDto, PaginatedResult } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

export function useDoctorWaitlist() {
  return useQuery({
    queryKey: ['doctor', 'waitlist'] as const,
    queryFn: () => apiFetch<PaginatedResult<DoctorWaitlistRowDto>>('/api/v1/doctor/waitlist?limit=50'),
  });
}
