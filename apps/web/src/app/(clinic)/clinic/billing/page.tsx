'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelectedClinic } from '@/hooks/clinic/use-selected-clinic';
import { useClinicBilling } from '@/hooks/clinic/use-clinic-billing';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';
import { formatDateTime } from '@/lib/format';

const STATUS_OPTIONS = ['CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'PENDING', 'CANCELLED'];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function formatMoney(amount: number, currency: string): string {
  const symbol = currency === 'INR' ? '₹' : `${currency} `;
  return `${symbol}${amount.toLocaleString('en-IN')}`;
}

function BillingContent() {
  const router = useRouter();
  const { clinics, clinicId, isLoading: clinicsLoading } = useSelectedClinic();
  const [from, setFrom] = useState(daysAgoIso(30));
  const [to, setTo] = useState(todayIso());
  const [status, setStatus] = useState('');
  const { data, isLoading } = useClinicBilling(clinicId, { from, to, status: status || undefined });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Billing</h1>
          <p className="text-muted-foreground text-sm">Payments, refunds, and collections for this clinic.</p>
        </div>
        {clinics.length > 1 && (
          <Select value={clinicId} onValueChange={(value) => value && router.push(`/clinic/billing?clinicId=${value}`)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select a clinic" />
            </SelectTrigger>
            <SelectContent>
              {clinics.map((c) => (
                <SelectItem key={c.clinicId} value={c.clinicId}>
                  {c.clinicName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="from">From</Label>
          <input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border-input bg-background flex h-9 rounded-md border px-3 py-1 text-sm" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="to">To</Label>
          <input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border-input bg-background flex h-9 rounded-md border px-3 py-1 text-sm" />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status || 'all'} onValueChange={(v) => setStatus(v === 'all' ? '' : (v ?? ''))}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {clinicsLoading || isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !clinicId ? (
        <EmptyState title="No clinic associated" description="You are not assigned to any clinic yet." />
      ) : data ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-muted-foreground text-sm">Total collected</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatMoney(data.summary.totalCollected, data.summary.currency)}</p>
                <p className="text-muted-foreground text-xs">{data.summary.successfulCount} successful payments</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-muted-foreground text-sm">Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatMoney(data.summary.pendingAmount, data.summary.currency)}</p>
                <p className="text-muted-foreground text-xs">{data.summary.failedCount} failed payments</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-muted-foreground text-sm">Refunded</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatMoney(data.summary.refundedAmount, data.summary.currency)}</p>
                <p className="text-muted-foreground text-xs">{data.summary.refundedCount} refunds</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent>
              {data.items.items.length === 0 ? (
                <EmptyState title="No payments" description="Payments for this filter will appear here." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Patient</TableHead>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.items.map((p) => (
                      <TableRow key={p.paymentId}>
                        <TableCell>
                          <p className="font-medium">{p.patientName}</p>
                          <p className="text-muted-foreground text-xs">{p.bookingReference}</p>
                        </TableCell>
                        <TableCell>{p.doctorName}</TableCell>
                        <TableCell>{formatDateTime(p.createdAt)}</TableCell>
                        <TableCell>{formatMoney(p.amount, p.currency)}</TableCell>
                        <TableCell>{p.method ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={p.status === 'CAPTURED' ? 'secondary' : p.status === 'FAILED' ? 'destructive' : 'outline'}>
                            {p.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

export default function ClinicBillingPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <BillingContent />
    </Suspense>
  );
}
