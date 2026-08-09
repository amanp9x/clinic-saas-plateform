'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/medical-records/history', label: 'History' },
  { href: '/medical-records/prescriptions', label: 'Prescriptions' },
  { href: '/medical-records/reports', label: 'Reports' },
  { href: '/medical-records/vaccinations', label: 'Vaccinations' },
  { href: '/medical-records/vitals', label: 'Vitals' },
  { href: '/medical-records/downloads', label: 'Downloads' },
] as const;

export function MedicalRecordsTabNav() {
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
