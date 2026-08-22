'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaginatedResult, RefundRequestDto, RefundRequestStatus } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

const REFUND_REQUESTS_KEY = ['clinic', 'refund-requests'] as const;

export function useClinicRefundRequests(clinicId: string | undefined, status?: RefundRequestStatus) {
  const params = new URLSearchParams({ limit: '50' });
  if (clinicId) params.set('clinicId', clinicId);
  if (status) params.set('status', status);

  return useQuery({
    queryKey: [...REFUND_REQUESTS_KEY, clinicId ?? null, status ?? 'ALL'],
    queryFn: () => apiFetch<PaginatedResult<RefundRequestDto>>(`/api/v1/payments/refund-requests?${params.toString()}`),
    enabled: Boolean(clinicId),
  });
}

function useRefundRequestAction(action: 'approve' | 'reject') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reviewNotes }: { id: string; reviewNotes?: string }) =>
      apiFetch<{ refundRequest: RefundRequestDto }>(`/api/v1/payments/refund-requests/${id}/${action}`, { method: 'PATCH', body: { reviewNotes } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REFUND_REQUESTS_KEY }),
  });
}

export function useApproveRefundRequest() {
  return useRefundRequestAction('approve');
}

export function useRejectRefundRequest() {
  return useRefundRequestAction('reject');
}
