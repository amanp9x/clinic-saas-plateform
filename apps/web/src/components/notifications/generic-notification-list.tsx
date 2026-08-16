'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';
import { useGenericMarkAllRead, useGenericMarkRead, useGenericNotifications } from '@/hooks/use-notifications';
import { EmptyState } from '@/components/marketing/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/format';

/** Full notifications page content shared by Reception and Clinic Admin — same list UI as the
 * patient/doctor portals' own pages, parametrized by cache scope instead of duplicated per role. */
export function GenericNotificationList({ scope, title, description }: { scope: string; title: string; description: string }) {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, isLoading } = useGenericNotifications(scope, unreadOnly);
  const markRead = useGenericMarkRead(scope);
  const markAllRead = useGenericMarkAllRead(scope);

  const hasUnread = data?.items.some((n) => !n.isRead) ?? false;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">{title}</h1>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        {hasUnread && (
          <Button size="sm" variant="outline" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
            <CheckCheck className="size-3.5" />
            Mark all as read
          </Button>
        )}
      </div>

      <div className="flex gap-1 border-b">
        {(['all', 'unread'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setUnreadOnly(option === 'unread')}
            className={cn(
              'shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium capitalize transition-colors',
              (option === 'unread') === unreadOnly ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {option}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={Bell} title={unreadOnly ? "You're all caught up" : 'No notifications yet'} />
      ) : (
        <div className="space-y-3">
          {data.items.map((n) => {
            const row = (
              <Card className={cn('transition-colors', !n.isRead && 'bg-primary/5 border-primary/30')}>
                <CardContent className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{n.title}</p>
                      <div className="flex shrink-0 items-center gap-2">
                        {(n.priority === 'HIGH' || n.priority === 'CRITICAL') && (
                          <Badge variant={n.priority === 'CRITICAL' ? 'destructive' : 'secondary'} className="text-[10px]">
                            {n.priority}
                          </Badge>
                        )}
                        {!n.isRead && <span className="bg-primary size-2 shrink-0 rounded-full" />}
                      </div>
                    </div>
                    <p className="text-muted-foreground text-sm">{n.message}</p>
                    <p className="text-muted-foreground/80 mt-1 text-xs">{formatRelativeTime(n.createdAt)}</p>
                  </div>
                </CardContent>
              </Card>
            );
            const onClick = () => !n.isRead && markRead.mutate(n.id);
            return n.actionUrl ? (
              <Link key={n.id} href={n.actionUrl} onClick={onClick} className="block">
                {row}
              </Link>
            ) : (
              <button key={n.id} type="button" onClick={onClick} className="block w-full text-left" disabled={n.isRead}>
                {row}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
