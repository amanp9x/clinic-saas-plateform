'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, LayoutDashboard, LifeBuoy, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

export const PLATFORM_ADMIN_NAV_LINKS = [
  { href: '/platform-admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/platform-admin/clinics', label: 'Clinics', icon: Building2 },
  { href: '/platform-admin/compliance', label: 'Compliance', icon: ShieldAlert },
  { href: '/platform-admin/tickets', label: 'Support Tickets', icon: LifeBuoy },
];

export function PlatformAdminNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {PLATFORM_ADMIN_NAV_LINKS.map((link) => {
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
