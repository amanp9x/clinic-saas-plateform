'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  PaginatedResult,
  SupportTicketCategory,
  SupportTicketDetailDto,
  SupportTicketRowDto,
  SupportTicketStatus,
} from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

const PLATFORM_TICKETS_KEY = ['platform-admin', 'tickets'] as const;

export interface PlatformSupportTicketFilters {
  status?: SupportTicketStatus;
  category?: SupportTicketCategory;
  search?: string;
  page?: number;
  limit?: number;
}

export function usePlatformSupportTickets(filters: PlatformSupportTicketFilters) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.category) params.set('category', filters.category);
  if (filters.search) params.set('search', filters.search);
  params.set('page', String(filters.page ?? 1));
  params.set('limit', String(filters.limit ?? 25));

  return useQuery({
    queryKey: [...PLATFORM_TICKETS_KEY, filters] as const,
    queryFn: () => apiFetch<PaginatedResult<SupportTicketRowDto>>(`/api/v1/platform-admin/tickets?${params.toString()}`),
  });
}

export function usePlatformSupportTicketDetail(id: string | undefined) {
  return useQuery({
    queryKey: [...PLATFORM_TICKETS_KEY, id] as const,
    queryFn: () => apiFetch<{ ticket: SupportTicketDetailDto }>(`/api/v1/platform-admin/tickets/${id}`),
    select: (data) => data.ticket,
    enabled: Boolean(id),
  });
}

export function useUpdateSupportTicketStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, resolutionNotes }: { id: string; status: 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'; resolutionNotes?: string }) =>
      apiFetch<{ ticket: SupportTicketDetailDto }>(`/api/v1/platform-admin/tickets/${id}/status`, { method: 'PATCH', body: { status, resolutionNotes } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PLATFORM_TICKETS_KEY }),
  });
}

export function useAddPlatformSupportTicketMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) =>
      apiFetch<{ ticket: SupportTicketDetailDto }>(`/api/v1/platform-admin/tickets/${id}/messages`, { method: 'POST', body: { message } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PLATFORM_TICKETS_KEY }),
  });
}
