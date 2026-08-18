'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  CalendarClock,
  ClipboardList,
  Clock,
  FileText,
  IndianRupee,
  LayoutDashboard,
  LineChart,
  Radio,
  Settings,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useUnreadNotificationCount } from '@/hooks/doctor/use-doctor-notifications';

export const DOCTOR_NAV_LINKS = [
  { href: '/doctor/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/doctor/appointments/today', label: 'Appointments', icon: CalendarClock, matchPrefix: '/doctor/appointments' },
  { href: '/doctor/queue', label: 'Live Queue', icon: Radio, matchPrefix: '/doctor/queue' },
  { href: '/doctor/schedule', label: 'Schedule', icon: CalendarClock, matchPrefix: '/doctor/schedule' },
  { href: '/doctor/prescriptions', label: 'Prescriptions', icon: FileText, matchPrefix: '/doctor/prescriptions' },
  { href: '/doctor/earnings', label: 'Earnings', icon: IndianRupee },
  { href: '/doctor/analytics', label: 'Analytics', icon: LineChart },
  { href: '/doctor/reviews', label: 'Reviews', icon: Star },
  { href: '/doctor/waitlist', label: 'Waitlist', icon: Clock },
  { href: '/doctor/follow-ups', label: 'Follow-ups', icon: ClipboardList },
  { href: '/doctor/notifications', label: 'Notifications', icon: Bell },
  { href: '/doctor/settings/profile', label: 'Settings', icon: Settings, matchPrefix: '/doctor/settings' },
];

export function DoctorNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: unreadCount } = useUnreadNotificationCount();

  return (
    <nav className="flex flex-col gap-1">
      {DOCTOR_NAV_LINKS.map((link) => {
        const isActive = pathname.startsWith(link.matchPrefix ?? link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <span className="flex items-center gap-3">
              <link.icon className="size-4" />
              {link.label}
            </span>
            {link.href === '/doctor/notifications' && Boolean(unreadCount) && (
              <Badge variant="secondary" className="h-5 min-w-5 justify-center px-1">
                {unreadCount}
              </Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
