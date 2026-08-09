import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  href: string;
}) {
  return (
    <Link href={href} className="block">
      <Card className="transition-colors hover:bg-muted/40">
        <CardContent className="flex items-center gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-2xl font-semibold leading-tight">{value}</p>
            <p className="text-muted-foreground text-sm">{label}</p>
            {hint && <p className="text-muted-foreground/80 text-xs">{hint}</p>}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <span className="bg-muted size-11 shrink-0 animate-pulse rounded-lg" />
        <div className="w-full space-y-2">
          <div className="bg-muted h-6 w-12 animate-pulse rounded" />
          <div className="bg-muted h-3.5 w-24 animate-pulse rounded" />
        </div>
      </CardContent>
    </Card>
  );
}
