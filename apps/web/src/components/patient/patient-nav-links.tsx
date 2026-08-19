'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, CalendarClock, Clock, CreditCard, LayoutDashboard, LifeBuoy, Settings, Star, Stethoscope } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useUnreadNotificationCount } from '@/hooks/patient/use-notifications';

export const PATIENT_NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/appointments/upcoming', label: 'Appointments', icon: CalendarClock, matchPrefix: '/appointments' },
  { href: '/medical-records/history', label: 'Medical Records', icon: Stethoscope, matchPrefix: '/medical-records' },
  { href: '/payments', label: 'Payments', icon: CreditCard },
  { href: '/reviews', label: 'My Reviews', icon: Star },
  { href: '/waitlist', label: 'Waitlist', icon: Clock },
  { href: '/support/tickets', label: 'Support', icon: LifeBuoy, matchPrefix: '/support' },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings/profile', label: 'Settings', icon: Settings, matchPrefix: '/settings' },
];

export function PatientNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: unreadCount } = useUnreadNotificationCount();

  return (
    <nav className="flex flex-col gap-1">
      {PATIENT_NAV_LINKS.map((link) => {
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
            {link.href === '/notifications' && Boolean(unreadCount) && (
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
