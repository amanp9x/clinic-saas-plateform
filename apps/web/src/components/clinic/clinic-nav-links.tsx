'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Stethoscope,
  Layers,
  ClipboardList,
  CalendarClock,
  CalendarOff,
  DoorOpen,
  Users,
  ShieldCheck,
  Settings,
  Radio,
  FileText,
  History,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const CLINIC_NAV_LINKS = [
  { href: '/clinic/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clinic/profile', label: 'Clinic Profile', icon: Building2 },
  { href: '/clinic/doctors', label: 'Doctors', icon: Stethoscope },
  { href: '/clinic/departments', label: 'Departments', icon: Layers },
  { href: '/clinic/services', label: 'Services', icon: ClipboardList },
  { href: '/clinic/schedule', label: 'Working Hours', icon: CalendarClock },
  { href: '/clinic/holidays', label: 'Holidays', icon: CalendarOff },
  { href: '/clinic/resources', label: 'Resources', icon: DoorOpen },
  { href: '/clinic/staff', label: 'Staff', icon: Users },
  { href: '/clinic/permissions', label: 'Permissions', icon: ShieldCheck },
  { href: '/clinic/queue-settings', label: 'Queue Settings', icon: Radio },
  { href: '/clinic/settings', label: 'Clinic Settings', icon: Settings },
  { href: '/clinic/documents', label: 'Documents', icon: FileText },
  { href: '/clinic/audit-logs', label: 'Audit Logs', icon: History },
  { href: '/clinic/reports', label: 'Reports', icon: BarChart3 },
];

export function ClinicNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {CLINIC_NAV_LINKS.map((link) => {
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
