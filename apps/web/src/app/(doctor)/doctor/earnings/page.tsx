'use client';

import { useState } from 'react';
import { IndianRupee } from 'lucide-react';
import { toast } from 'sonner';
import type { SettlementStatus } from '@clinic/shared';
import { useDoctorEarnings } from '@/hooks/doctor/use-earnings';
import { useDoctorSettlements, useRequestSettlement } from '@/hooks/doctor/use-doctor-settlements';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/marketing/empty-state';
import { ApiError } from '@/lib/api-client';
import { formatFee, formatDate } from '@/lib/format';

const RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
] as const;

const STATUS_VARIANT: Record<SettlementStatus, 'secondary' | 'outline' | 'destructive' | 'default'> = {
  REQUESTED: 'secondary',
  APPROVED: 'default',
  REJECTED: 'destructive',
  PAID: 'outline',
};

export default function EarningsPage() {
  const [range, setRange] = useState<'today' | 'week' | 'month'>('today');
  const { data: earnings, isLoading } = useDoctorEarnings(range);
  const { data: settlements, isLoading: settlementsLoading } = useDoctorSettlements();
  const requestSettlement = useRequestSettlement();

  const hasActiveRequest = settlements?.some((s) => s.status === 'REQUESTED' || s.status === 'APPROVED') ?? false;
  const pendingAmount = earnings ? Number(earnings.pendingSettlements) : 0;

  function handleRequest() {
    requestSettlement.mutate(undefined, {
      onSuccess: () => toast.success('Settlement requested'),
      onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not request settlement'),
    });
  }

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
            <CardContent className="space-y-3">
              <p className="text-2xl font-semibold">{formatFee(earnings.pendingSettlements)}</p>
              <p className="text-muted-foreground text-xs">Earnings not yet covered by a paid settlement, regardless of the range selected above.</p>
              <Button
                size="sm"
                disabled={hasActiveRequest || pendingAmount <= 0 || requestSettlement.isPending}
                onClick={handleRequest}
              >
                {requestSettlement.isPending ? 'Requesting…' : hasActiveRequest ? 'Request pending' : 'Request settlement'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <div>
        <h2 className="font-heading text-lg font-semibold">Settlement history</h2>
        <p className="text-muted-foreground text-sm">Your past and pending settlement requests.</p>
      </div>

      {settlementsLoading || !settlements ? (
        <Skeleton className="h-40 w-full" />
      ) : settlements.length === 0 ? (
        <EmptyState icon={IndianRupee} title="No settlement requests yet" description="Request a settlement once you have unpaid earnings." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settlements.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDate(s.periodStart)} – {formatDate(s.periodEnd)}
                    </TableCell>
                    <TableCell className="font-medium">{formatFee(s.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[s.status]}>{s.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{formatDate(s.createdAt)}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{s.reviewNotes ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
