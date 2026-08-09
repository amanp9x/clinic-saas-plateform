'use client';

import { useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useDoctorNotifications, useMarkAllNotificationsRead } from '@/hooks/doctor/use-doctor-notifications';
import { DoctorNotificationItem } from '@/components/doctor/doctor-notification-item';
import { EmptyState } from '@/components/marketing/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function DoctorNotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, isLoading } = useDoctorNotifications(unreadOnly);
  const markAllRead = useMarkAllNotificationsRead();

  const hasUnread = data?.items.some((n) => !n.isRead) ?? false;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Notifications</h1>
          <p className="text-muted-foreground text-sm">Appointment, queue, and prescription updates.</p>
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
              (option === 'unread') === unreadOnly
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
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
          <Skeleton className="h-20 w-full" />
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={unreadOnly ? "You're all caught up" : 'No notifications yet'}
          description={unreadOnly ? 'No unread notifications right now.' : 'Updates about your appointments and queue will show up here.'}
        />
      ) : (
        <div className="space-y-3">
          {data.items.map((notification) => (
            <DoctorNotificationItem key={notification.id} notification={notification} />
          ))}
        </div>
      )}
    </div>
  );
}
