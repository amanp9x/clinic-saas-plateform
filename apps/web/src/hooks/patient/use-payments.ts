'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateRefundRequestInput, PaginatedResult, PaymentDto, PaymentOrderDto, PaymentSummaryDto, RefundRequestDto } from '@clinic/shared';
import { apiFetch, ApiError } from '@/lib/api-client';
import { clientEnv } from '@/lib/env';
import { tokenStore } from '@/lib/token-store';

const PAYMENTS_KEY = ['patient', 'payments'] as const;

export function usePayment(paymentId: string | undefined) {
  return useQuery({
    queryKey: [...PAYMENTS_KEY, paymentId ?? null],
    queryFn: () => apiFetch<{ payment: PaymentDto }>(`/api/v1/payments/${paymentId}`),
    select: (data) => data.payment,
    enabled: Boolean(paymentId),
    refetchInterval: (query) => {
      const status = query.state.data?.payment.status;
      return status === 'PENDING' || status === 'CREATED' ? 4000 : false;
    },
  });
}

export function usePaymentHistory(page = 1, limit = 10) {
  return useQuery({
    queryKey: [...PAYMENTS_KEY, 'history', page, limit],
    queryFn: () => apiFetch<PaginatedResult<PaymentSummaryDto>>(`/api/v1/payments?page=${page}&limit=${limit}`),
  });
}

export function useCreatePaymentOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (appointmentId: string) => apiFetch<{ order: PaymentOrderDto }>('/api/v1/payments/create-order', { method: 'POST', body: { appointmentId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PAYMENTS_KEY }),
  });
}

export function useRetryPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) => apiFetch<{ order: PaymentOrderDto }>(`/api/v1/payments/${paymentId}/retry`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PAYMENTS_KEY }),
  });
}

export function useSimulateCheckout() {
  return useMutation({
    mutationFn: ({ paymentId, outcome }: { paymentId: string; outcome: 'success' | 'failure' }) =>
      apiFetch<{ providerPaymentId: string; providerSignature: string | null; providerOrderId: string }>(`/api/v1/payments/${paymentId}/simulate`, {
        method: 'POST',
        body: { outcome },
      }),
  });
}

export function useRequestRefund(paymentId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRefundRequestInput) =>
      apiFetch<{ refundRequest: RefundRequestDto }>(`/api/v1/payments/${paymentId}/refund-request`, { method: 'POST', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...PAYMENTS_KEY, paymentId ?? null] });
      queryClient.invalidateQueries({ queryKey: [...PAYMENTS_KEY, 'history'] });
    },
  });
}

export function useVerifyPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { paymentId: string; providerOrderId: string; providerPaymentId: string; providerSignature: string }) =>
      apiFetch<{ payment: PaymentDto }>('/api/v1/payments/verify', { method: 'POST', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: ['patient', 'appointments'] });
      queryClient.invalidateQueries({ queryKey: ['patient', 'dashboard-summary'] });
    },
  });
}

/** No dedicated JSON hook — the receipt endpoint returns a raw PDF, so this fetches it as a blob
 * (attaching the auth header manually, same as apiFetch) and triggers a browser download. */
export async function downloadReceipt(paymentId: string, filename: string): Promise<void> {
  const accessToken = tokenStore.get();
  const res = await fetch(`${clientEnv.apiUrl}/api/v1/payments/${paymentId}/receipt`, {
    credentials: 'include',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!res.ok) {
    throw new ApiError('DOWNLOAD_FAILED', 'Could not download the receipt', res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
