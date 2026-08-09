'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/appointments/upcoming', label: 'Upcoming' },
  { href: '/appointments/today', label: 'Today' },
  { href: '/appointments/completed', label: 'Completed' },
  { href: '/appointments/cancelled', label: 'Cancelled' },
] as const;

export function AppointmentsTabNav() {
  const pathname = usePathname();

  return (
    <nav className="flex w-full gap-1 overflow-x-auto border-b">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
