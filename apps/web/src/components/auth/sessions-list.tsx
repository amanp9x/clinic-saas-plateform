'use client';

import { toast } from 'sonner';
import { Laptop, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useRevokeSession, useSessions } from '@/hooks/use-sessions';
import { ApiError } from '@/lib/api-client';

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function SessionsList() {
  const { data: sessions, isLoading } = useSessions();
  const revokeSession = useRevokeSession();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (!sessions || sessions.length === 0) {
    return <p className="text-muted-foreground text-sm">No active sessions.</p>;
  }

  return (
    <ul className="divide-y rounded-lg border">
      {sessions.map((session) => {
        const isMobile = /mobile|android|iphone/i.test(session.deviceLabel ?? '');
        return (
          <li key={session.id} className="flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              {isMobile ? (
                <Smartphone className="text-muted-foreground size-5" />
              ) : (
                <Laptop className="text-muted-foreground size-5" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {session.deviceLabel ?? 'Unknown device'}
                  </span>
                  {session.isCurrent && <Badge variant="secondary">This device</Badge>}
                </div>
                <p className="text-muted-foreground text-xs">
                  {session.ipAddress ?? 'Unknown IP'} · last active{' '}
                  {formatRelative(session.lastUsedAt)}
                </p>
              </div>
            </div>
            {!session.isCurrent && (
              <Button
                variant="ghost"
                size="sm"
                disabled={revokeSession.isPending}
                onClick={() =>
                  revokeSession.mutate(session.id, {
                    onSuccess: () => toast.success('Session signed out'),
                    onError: (err) =>
                      toast.error(
                        err instanceof ApiError ? err.message : 'Could not sign out session',
                      ),
                  })
                }
              >
                Sign out
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
