'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MyReviewDto, PaginatedResult, ReviewEligibilityDto } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

const REVIEWS_KEY = ['patient', 'reviews'] as const;

export function useReviewEligibility(appointmentId: string | undefined) {
  return useQuery({
    queryKey: [...REVIEWS_KEY, 'eligibility', appointmentId ?? null],
    queryFn: () => apiFetch<{ eligibility: ReviewEligibilityDto }>(`/api/v1/reviews/eligible?appointmentId=${appointmentId}`),
    select: (data) => data.eligibility,
    enabled: Boolean(appointmentId),
  });
}

export function useMyReviews(page = 1, limit = 20) {
  return useQuery({
    queryKey: [...REVIEWS_KEY, 'my', page, limit],
    queryFn: () => apiFetch<PaginatedResult<MyReviewDto>>(`/api/v1/reviews/my?page=${page}&limit=${limit}`),
  });
}

export interface SubmitReviewPayload {
  appointmentId: string;
  doctorReview?: { rating: number; consultationExperience?: number; communication?: number; professionalism?: number; explanationClarity?: number; comment?: string };
  clinicReview?: { rating: number; staffExperience?: number; cleanliness?: number; waitingExperience?: number; overallExperience?: number; comment?: string };
}

export function useSubmitReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SubmitReviewPayload) => apiFetch<{ reviews: MyReviewDto[] }>('/api/v1/reviews', { method: 'POST', body: payload }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: REVIEWS_KEY });
      queryClient.invalidateQueries({ queryKey: [...REVIEWS_KEY, 'eligibility', variables.appointmentId] });
    },
  });
}

export function useUpdateReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; rating?: number; comment?: string | null }) =>
      apiFetch<{ review: MyReviewDto }>(`/api/v1/reviews/${id}`, { method: 'PATCH', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REVIEWS_KEY }),
  });
}

export function useDeleteReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/api/v1/reviews/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REVIEWS_KEY }),
  });
}
