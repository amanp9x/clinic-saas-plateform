'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationDto, NotificationPreferenceDto, NotificationPreferenceInput, PaginatedResult } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

/** Portal-agnostic notification hooks — used directly by Reception/Clinic Admin (which had no
 * notification center before Phase 10). Patient/Doctor keep their own pre-existing hook files
 * (same endpoints, separate React Query cache namespace) rather than being migrated here, to
 * avoid touching already-working call sites. */
export function useGenericNotifications(scope: string, unreadOnly = false) {
  return useQuery({
    queryKey: [scope, 'notifications', unreadOnly] as const,
    queryFn: () => apiFetch<PaginatedResult<NotificationDto>>(`/api/v1/notifications?limit=30${unreadOnly ? '&unreadOnly=true' : ''}`),
  });
}

export function useGenericUnreadCount(scope: string) {
  return useQuery({
    queryKey: [scope, 'notifications', 'unread-count'] as const,
    queryFn: () => apiFetch<{ count: number }>('/api/v1/notifications/unread-count'),
    select: (data) => data.count,
    refetchInterval: 60_000,
  });
}

export function useGenericMarkRead(scope: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/api/v1/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [scope, 'notifications'] }),
  });
}

export function useGenericMarkAllRead(scope: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<null>('/api/v1/notifications/read-all', { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [scope, 'notifications'] }),
  });
}

export function useGenericDeleteNotification(scope: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/api/v1/notifications/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [scope, 'notifications'] }),
  });
}

export function useGenericNotificationPreferences(scope: string) {
  return useQuery({
    queryKey: [scope, 'notifications', 'preferences'] as const,
    queryFn: () => apiFetch<{ preferences: NotificationPreferenceDto }>('/api/v1/notification-preferences'),
    select: (data) => data.preferences,
  });
}

export function useGenericUpdateNotificationPreferences(scope: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NotificationPreferenceInput) =>
      apiFetch<{ preferences: NotificationPreferenceDto }>('/api/v1/notification-preferences', { method: 'PATCH', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [scope, 'notifications', 'preferences'] }),
  });
}
