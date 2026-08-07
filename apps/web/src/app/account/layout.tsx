import type { ReactNode } from 'react';
import { RequireAuth } from '@/components/auth/require-auth';

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <div className="mx-auto w-full max-w-2xl px-4 py-10">{children}</div>
    </RequireAuth>
  );
}
