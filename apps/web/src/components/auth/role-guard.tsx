'use client';

import type { ReactNode } from 'react';
import type { UserRole } from '@clinic/shared';
import { useAuth } from '@/hooks/use-auth';

interface RoleGuardProps {
  allow: UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

/** Hides `children` unless the current user's role is in `allow`. Pairs with RequireAuth for gated pages. */
export function RoleGuard({ allow, children, fallback = null }: RoleGuardProps) {
  const { user } = useAuth();
  if (!user || !allow.includes(user.role)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
