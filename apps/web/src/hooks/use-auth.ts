'use client';

import { useQuery } from '@tanstack/react-query';
import type { AuthenticatedUser } from '@clinic/shared';
import { apiFetch, ApiError } from '@/lib/api-client';

export const AUTH_QUERY_KEY = ['auth', 'me'] as const;

/** Resolves the current authenticated user, or null when signed out. Never throws. */
export function useAuth() {
  const query = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async (): Promise<AuthenticatedUser | null> => {
      try {
        const { user } = await apiFetch<{ user: AuthenticatedUser }>('/api/v1/auth/me');
        return user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 60_000,
    retry: false,
  });

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isAuthenticated: Boolean(query.data),
    refetch: query.refetch,
  };
}
