'use client';

import Link from 'next/link';
import { Bell, CalendarClock, FlaskConical, Pill, Radio } from 'lucide-react';
import type { NotificationDto } from '@clinic/shared';
import { useMarkNotificationRead } from '@/hooks/patient/use-notifications';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/format';

const TYPE_ICON: Record<NotificationDto['type'], typeof Bell> = {
  APPOINTMENT_UPDATE: CalendarClock,
  QUEUE_UPDATE: Radio,
  PRESCRIPTION_READY: Pill,
  REPORT_READY: FlaskConical,
  SYSTEM: Bell,
};

function resolveHref(notification: NotificationDto): string | null {
  if (notification.relatedEntityType === 'Appointment' && notification.relatedEntityId) {
    return `/appointments/${notification.relatedEntityId}`;
  }
  if (notification.type === 'PRESCRIPTION_READY') return '/medical-records/prescriptions';
  if (notification.type === 'REPORT_READY') return '/medical-records/reports';
  return null;
}

export function NotificationItem({ notification }: { notification: NotificationDto }) {
  const markRead = useMarkNotificationRead();
  const Icon = TYPE_ICON[notification.type];
  const href = resolveHref(notification);

  const handleClick = () => {
    if (!notification.isRead) markRead.mutate(notification.id);
  };

  const content = (
    <Card
      className={cn('transition-colors', !notification.isRead && 'bg-primary/5 border-primary/30')}
    >
      <CardContent className="flex items-start gap-3">
        <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{notification.title}</p>
            {!notification.isRead && <span className="bg-primary size-2 shrink-0 rounded-full" />}
          </div>
          <p className="text-muted-foreground text-sm">{notification.message}</p>
          <p className="text-muted-foreground/80 mt-1 text-xs">{formatRelativeTime(notification.createdAt)}</p>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} onClick={handleClick} className="block">
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={handleClick} className="block w-full text-left" disabled={notification.isRead}>
      {content}
    </button>
  );
}
