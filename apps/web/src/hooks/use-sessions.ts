'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SessionSummary } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

const SESSIONS_QUERY_KEY = ['auth', 'sessions'] as const;

export function useSessions() {
  return useQuery({
    queryKey: SESSIONS_QUERY_KEY,
    queryFn: () => apiFetch<{ sessions: SessionSummary[] }>('/api/v1/auth/sessions'),
    select: (data) => data.sessions,
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch<null>(`/api/v1/auth/sessions/${sessionId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY }),
  });
}
