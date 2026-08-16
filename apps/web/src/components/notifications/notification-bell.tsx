'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import type { NotificationDto } from '@clinic/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/format';

/** Presentational only — fed by whichever hooks the calling portal already uses (patient/doctor
 * keep their existing per-portal hooks; reception/clinic use the new generic ones), so this one
 * component covers all four portals' "Bell icon, unread count, dropdown" requirement without
 * duplicating fetch logic per portal. */
export function NotificationBell({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  viewAllHref,
}: {
  notifications: NotificationDto[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  viewAllHref?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <Badge variant="destructive" className="absolute -right-1 -top-1 h-4 min-w-4 justify-center px-1 text-[10px]">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Notifications</span>
          {unreadCount > 0 && (
            <button type="button" onClick={onMarkAllRead} className="text-primary text-xs hover:underline">
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-muted-foreground p-4 text-center text-sm">No notifications yet.</p>
          ) : (
            notifications.slice(0, 8).map((n) => {
              const row = (
                <div className={cn('flex items-start gap-2 border-b px-3 py-2.5 last:border-b-0', !n.isRead && 'bg-primary/5')}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{n.title}</p>
                    <p className="text-muted-foreground line-clamp-2 text-xs">{n.message}</p>
                    <p className="text-muted-foreground/80 mt-0.5 text-[11px]">{formatRelativeTime(n.createdAt)}</p>
                  </div>
                  {!n.isRead && <span className="bg-primary mt-1 size-2 shrink-0 rounded-full" />}
                </div>
              );
              return n.actionUrl ? (
                <Link key={n.id} href={n.actionUrl} onClick={() => !n.isRead && onMarkRead(n.id)} className="block hover:bg-muted/50">
                  {row}
                </Link>
              ) : (
                <button key={n.id} type="button" onClick={() => !n.isRead && onMarkRead(n.id)} className="block w-full text-left hover:bg-muted/50">
                  {row}
                </button>
              );
            })
          )}
        </div>
        {viewAllHref && (
          <Link href={viewAllHref} className="text-primary block border-t px-3 py-2 text-center text-xs font-medium hover:underline">
            View all notifications
          </Link>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
