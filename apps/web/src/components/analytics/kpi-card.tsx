import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function KpiCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  /** `null`/`undefined` renders as "—" (a genuinely unavailable metric) — distinct from `0`,
   * which renders as the digit "0" (a real zero value). Never collapse the two. */
  value: string | number | null | undefined;
  icon?: LucideIcon;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">{label}</CardTitle>
        {Icon && <Icon className="text-muted-foreground size-4" />}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value === null || value === undefined ? '—' : value}</p>
        {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
      </CardContent>
    </Card>
  );
}
