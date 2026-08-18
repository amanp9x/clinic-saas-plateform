'use client';

import { useQuery } from '@tanstack/react-query';
import type { FollowUpRowDto, PaginatedResult } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

export function useDoctorFollowUps() {
  return useQuery({
    queryKey: ['doctor', 'follow-ups'] as const,
    queryFn: () => apiFetch<PaginatedResult<FollowUpRowDto>>('/api/v1/doctor/follow-ups?limit=50'),
  });
}
