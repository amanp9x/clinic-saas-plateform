'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResult, ReviewModerationRowDto, ReviewStatusValue } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

export interface ClinicReviewFilters {
  type?: 'DOCTOR' | 'CLINIC';
  status?: ReviewStatusValue;
  rating?: number;
  doctorId?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

const REVIEWS_KEY = ['clinic', 'reviews'] as const;

export function useClinicReviews(clinicId: string | undefined, filters: ClinicReviewFilters) {
  const params = new URLSearchParams();
  if (clinicId) params.set('clinicId', clinicId);
  if (filters.type) params.set('type', filters.type);
  if (filters.status) params.set('status', filters.status);
  if (filters.rating) params.set('rating', String(filters.rating));
  if (filters.doctorId) params.set('doctorId', filters.doctorId);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.search) params.set('search', filters.search);
  params.set('page', String(filters.page ?? 1));
  params.set('limit', String(filters.limit ?? 25));

  return useQuery({
    queryKey: [...REVIEWS_KEY, clinicId ?? null, filters] as const,
    queryFn: () => apiFetch<PaginatedResult<ReviewModerationRowDto>>(`/api/v1/clinic/reviews?${params.toString()}`),
    enabled: Boolean(clinicId),
  });
}

export function useModerateReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: ReviewStatusValue; reason?: string }) =>
      apiFetch<{ review: ReviewModerationRowDto }>(`/api/v1/clinic/reviews/${id}/status`, { method: 'PATCH', body: { status, reason } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REVIEWS_KEY }),
  });
}

export function useRespondToClinicReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, response }: { id: string; response: string }) =>
      apiFetch<{ review: ReviewModerationRowDto }>(`/api/v1/clinic/reviews/${id}/respond`, { method: 'POST', body: { response } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REVIEWS_KEY }),
  });
}
