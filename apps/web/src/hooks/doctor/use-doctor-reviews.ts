'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DoctorReviewDetailDto, DoctorReviewSummaryDto } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

const REVIEWS_KEY = ['doctor', 'reviews'] as const;

export function useDoctorReviews() {
  return useQuery({
    queryKey: REVIEWS_KEY,
    queryFn: () => apiFetch<{ reviews: DoctorReviewSummaryDto }>('/api/v1/doctor/reviews'),
    select: (data) => data.reviews,
  });
}

export function useRespondToReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, response }: { id: string; response: string }) =>
      apiFetch<{ review: DoctorReviewDetailDto }>(`/api/v1/doctor/reviews/${id}/respond`, {
        method: 'POST',
        body: { response },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REVIEWS_KEY }),
  });
}
