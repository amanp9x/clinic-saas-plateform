'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateSupportTicketInput, PaginatedResult, SupportTicketDetailDto, SupportTicketRowDto, SupportTicketStatus } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

const TICKETS_KEY = ['support-tickets'] as const;

export interface MySupportTicketFilters {
  status?: SupportTicketStatus;
  page?: number;
  limit?: number;
}

export function useMySupportTickets(filters: MySupportTicketFilters) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  params.set('page', String(filters.page ?? 1));
  params.set('limit', String(filters.limit ?? 20));

  return useQuery({
    queryKey: [...TICKETS_KEY, 'mine', filters] as const,
    queryFn: () => apiFetch<PaginatedResult<SupportTicketRowDto>>(`/api/v1/support/tickets?${params.toString()}`),
  });
}

export function useSupportTicketDetail(id: string | undefined) {
  return useQuery({
    queryKey: [...TICKETS_KEY, id] as const,
    queryFn: () => apiFetch<{ ticket: SupportTicketDetailDto }>(`/api/v1/support/tickets/${id}`),
    select: (data) => data.ticket,
    enabled: Boolean(id),
  });
}

export function useCreateSupportTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSupportTicketInput) => apiFetch<{ ticket: SupportTicketDetailDto }>('/api/v1/support/tickets', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TICKETS_KEY }),
  });
}

export function useAddSupportTicketMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) =>
      apiFetch<{ ticket: SupportTicketDetailDto }>(`/api/v1/support/tickets/${id}/messages`, { method: 'POST', body: { message } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TICKETS_KEY }),
  });
}

export function useWithdrawSupportTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ticket: SupportTicketDetailDto }>(`/api/v1/support/tickets/${id}/withdraw`, { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TICKETS_KEY }),
  });
}

export function useReopenSupportTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ticket: SupportTicketDetailDto }>(`/api/v1/support/tickets/${id}/reopen`, { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TICKETS_KEY }),
  });
}
