'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarClock, LayoutDashboard, Radio, Search, UserPlus, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const RECEPTION_NAV_LINKS = [
  { href: '/reception/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/reception/appointments', label: 'Appointments', icon: CalendarClock },
  { href: '/reception/queue', label: 'Live Queue', icon: Radio },
  { href: '/reception/walkin', label: 'Walk-in', icon: UserPlus },
  { href: '/reception/patients', label: 'Patient Search', icon: Search },
  { href: '/reception/reports', label: 'Reports', icon: BarChart3 },
];

export function ReceptionNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {RECEPTION_NAV_LINKS.map((link) => {
        const isActive = pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <link.icon className="size-4" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
