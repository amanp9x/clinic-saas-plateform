'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ContactMessageDetailDto, ContactMessageRowDto, ContactMessageStatus, PaginatedResult } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

const PLATFORM_CONTACT_MESSAGES_KEY = ['platform-admin', 'contact-messages'] as const;

export interface PlatformContactMessageFilters {
  status?: ContactMessageStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export function usePlatformContactMessages(filters: PlatformContactMessageFilters) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);
  params.set('page', String(filters.page ?? 1));
  params.set('limit', String(filters.limit ?? 25));

  return useQuery({
    queryKey: [...PLATFORM_CONTACT_MESSAGES_KEY, filters] as const,
    queryFn: () => apiFetch<PaginatedResult<ContactMessageRowDto>>(`/api/v1/platform-admin/contact-messages?${params.toString()}`),
  });
}

export function usePlatformContactMessageDetail(id: string | undefined) {
  return useQuery({
    queryKey: [...PLATFORM_CONTACT_MESSAGES_KEY, id] as const,
    queryFn: () => apiFetch<{ message: ContactMessageDetailDto }>(`/api/v1/platform-admin/contact-messages/${id}`),
    select: (data) => data.message,
    enabled: Boolean(id),
  });
}

export function useUpdateContactMessageStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, adminReply }: { id: string; status: 'IN_PROGRESS' | 'RESOLVED'; adminReply?: string }) =>
      apiFetch<{ message: ContactMessageDetailDto }>(`/api/v1/platform-admin/contact-messages/${id}/status`, {
        method: 'PATCH',
        body: { status, adminReply },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PLATFORM_CONTACT_MESSAGES_KEY }),
  });
}
