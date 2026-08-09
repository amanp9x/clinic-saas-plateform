'use client';

import { useState } from 'react';
import { IndianRupee } from 'lucide-react';
import { useDoctorEarnings } from '@/hooks/doctor/use-earnings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatFee } from '@/lib/format';

const RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
] as const;

export default function EarningsPage() {
  const [range, setRange] = useState<'today' | 'week' | 'month'>('today');
  const { data: earnings, isLoading } = useDoctorEarnings(range);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Earnings</h1>
        <p className="text-muted-foreground text-sm">Track consultation earnings and platform commission.</p>
      </div>

      <Tabs value={range} onValueChange={(v) => setRange(v as typeof range)}>
        <TabsList>
          {RANGES.map((r) => (
            <TabsTrigger key={r.value} value={r.value}>
              {r.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading || !earnings ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IndianRupee className="size-4" />
                Total Earnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{formatFee(earnings.totalEarnings)}</p>
              <p className="text-muted-foreground text-sm">
                {earnings.completedConsultations} completed consultation{earnings.completedConsultations === 1 ? '' : 's'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Net Earnings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{formatFee(earnings.netEarnings)}</p>
              <p className="text-muted-foreground text-sm">After {earnings.platformCommissionPercent}% platform commission</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Platform Commission</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatFee(earnings.platformCommissionAmount)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Pending Settlement</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{formatFee(earnings.pendingSettlements)}</p>
              <p className="text-muted-foreground text-xs">
                Reflects fees collected for this range — no settlement engine tracks actual payout status yet.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
