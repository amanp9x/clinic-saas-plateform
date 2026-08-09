'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationDto, NotificationPreferenceInput, PaginatedResult } from '@clinic/shared';
import type { NotificationPreferenceDto } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

const NOTIFICATIONS_KEY = ['patient', 'notifications'] as const;

export function useNotifications(unreadOnly = false) {
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, unreadOnly],
    queryFn: () =>
      apiFetch<PaginatedResult<NotificationDto>>(
        `/api/v1/notifications?limit=30${unreadOnly ? '&unreadOnly=true' : ''}`,
      ),
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'unread-count'],
    queryFn: () => apiFetch<{ count: number }>('/api/v1/notifications/unread-count'),
    select: (data) => data.count,
    refetchInterval: 60_000,
  });
}

function useInvalidateNotifications() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
}

export function useMarkNotificationRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/api/v1/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: invalidate,
  });
}

export function useMarkAllNotificationsRead() {
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: () => apiFetch<null>('/api/v1/notifications/read-all', { method: 'POST' }),
    onSuccess: invalidate,
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'preferences'],
    queryFn: () =>
      apiFetch<{ preferences: NotificationPreferenceDto }>('/api/v1/notifications/preferences'),
    select: (data) => data.preferences,
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NotificationPreferenceInput) =>
      apiFetch<{ preferences: NotificationPreferenceDto }>('/api/v1/notifications/preferences', {
        method: 'PUT',
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...NOTIFICATIONS_KEY, 'preferences'] }),
  });
}
