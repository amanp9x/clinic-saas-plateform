'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { DateRangePreset } from '@clinic/shared';
import { useSelectedClinic } from '@/hooks/clinic/use-selected-clinic';
import {
  useAnalyticsOverview,
  useAppointmentAnalytics,
  useRevenueAnalytics,
  useDoctorPerformance,
  downloadAnalyticsExport,
} from '@/hooks/analytics/use-analytics';
import { KpiCard } from '@/components/analytics/kpi-card';
import { TrendBarChart } from '@/components/analytics/trend-bar-chart';
import { DateRangeControl } from '@/components/analytics/date-range-control';
import { formatCurrency, formatMinutes, formatPercent } from '@/components/analytics/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ApiError } from '@/lib/api-client';
import { Download } from 'lucide-react';

function AnalyticsContent() {
  const router = useRouter();
  const { clinics, clinicId, isLoading: clinicsLoading } = useSelectedClinic();
  const [range, setRange] = useState<DateRangePreset>('last7days');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [exporting, setExporting] = useState(false);
  const params = { range, from, to };

  const { data: overview, isLoading: overviewLoading, isError: overviewError } = useAnalyticsOverview(clinicId, params);
  const { data: appointmentData, isLoading: appointmentsLoading } = useAppointmentAnalytics(clinicId, params, { trend: 'day' });
  const { data: revenueData, isLoading: revenueLoading } = useRevenueAnalytics(clinicId, params, 'day');
  const { data: doctorRows, isLoading: doctorsLoading } = useDoctorPerformance(clinicId, params);

  async function handleExport() {
    if (!clinicId) return;
    setExporting(true);
    try {
      await downloadAnalyticsExport(clinicId, 'appointments', params, `appointment-report-${clinicId}.csv`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not export the report');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Analytics</h1>
          <p className="text-muted-foreground text-sm">Operational and financial insights for your clinic.</p>
        </div>
        <div className="flex items-center gap-3">
          {clinics.length > 1 && (
            <Select value={clinicId} onValueChange={(value) => value && router.push(`/clinic/analytics?clinicId=${value}`)}>
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
          <Button variant="outline" onClick={handleExport} disabled={exporting || !clinicId}>
            <Download className="mr-2 size-4" />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        </div>
      </div>

      <DateRangeControl range={range} from={from} to={to} onChange={(next) => { setRange(next.range); setFrom(next.from); setTo(next.to); }} />

      {clinicsLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !clinicId ? (
        <EmptyState title="No clinic associated" description="You are not assigned to any clinic yet." />
      ) : overviewError ? (
        <EmptyState title="Could not load analytics" description="Something went wrong loading this dashboard. Try again." />
      ) : overviewLoading || !overview ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Total Appointments" value={overview.appointments.total} />
            <KpiCard label="Completed" value={overview.appointments.completed} hint={formatPercent(overview.appointments.completionRate)} />
            <KpiCard label="Cancelled" value={overview.appointments.cancelled} hint={formatPercent(overview.appointments.cancellationRate)} />
            <KpiCard label="No-shows" value={overview.appointments.noShow} hint={formatPercent(overview.appointments.noShowRate)} />
            <KpiCard label="Net Revenue" value={formatCurrency(overview.revenue.netCollected, overview.revenue.currency)} />
            <KpiCard label="Patients Served" value={overview.patients.totalPatientsServed} hint={`${overview.patients.newPatients} new · ${overview.patients.returningPatients} returning`} />
            <KpiCard label="Avg. Waiting Time" value={formatMinutes(overview.averageWaitingMinutes)} />
            <KpiCard label="Avg. Delay" value={formatMinutes(overview.averageDelayMinutes)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Appointment Trend</CardTitle>
              </CardHeader>
              <CardContent>
                {appointmentsLoading ? <Skeleton className="h-40 w-full" /> : <TrendBarChart title="Appointments per day" points={appointmentData?.trend ?? []} />}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
              </CardHeader>
              <CardContent>
                {revenueLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : (
                  <TrendBarChart title="Revenue per day" valueKey="amount" points={(revenueData?.breakdownBy as { bucket: string; amount: number; count: number }[] | undefined)?.map((r) => ({ bucket: r.bucket, count: r.count, amount: r.amount })) ?? []} />
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Doctor Performance</CardTitle>
            </CardHeader>
            <CardContent>
              {doctorsLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : !doctorRows || doctorRows.length === 0 ? (
                <EmptyState title="No data available for the selected period." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Appointments</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Avg. Wait</TableHead>
                      <TableHead>Avg. Delay</TableHead>
                      <TableHead>Utilization</TableHead>
                      <TableHead>Rating</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {doctorRows.map((row) => (
                      <TableRow key={row.doctorId}>
                        <TableCell className="font-medium">{row.doctorName}</TableCell>
                        <TableCell>{row.appointments}</TableCell>
                        <TableCell>{row.completed}</TableCell>
                        <TableCell>{formatMinutes(row.averageWaitingMinutes)}</TableCell>
                        <TableCell>{formatMinutes(row.averageDelayMinutes)}</TableCell>
                        <TableCell>{formatPercent(row.utilization)}</TableCell>
                        <TableCell>{row.averageRating ? row.averageRating.toFixed(1) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default function ClinicAnalyticsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <AnalyticsContent />
    </Suspense>
  );
}
