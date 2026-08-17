'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import type { DateRangePreset } from '@clinic/shared';
import { useDoctorClinics } from '@/hooks/doctor/use-doctor-clinics';
import { useAppointmentAnalytics, useQueueAnalytics, useDoctorPerformance, downloadAnalyticsExport } from '@/hooks/analytics/use-analytics';
import { KpiCard } from '@/components/analytics/kpi-card';
import { TrendBarChart } from '@/components/analytics/trend-bar-chart';
import { DateRangeControl } from '@/components/analytics/date-range-control';
import { formatMinutes, formatPercent } from '@/components/analytics/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';
import { ApiError } from '@/lib/api-client';
import { Download } from 'lucide-react';

function DoctorAnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: clinics, isLoading: clinicsLoading } = useDoctorClinics();
  const activeClinics = (clinics ?? []).filter((c) => c.isActive);
  const clinicId = searchParams.get('clinicId') ?? activeClinics[0]?.clinicId;
  const [range, setRange] = useState<DateRangePreset>('last7days');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [exporting, setExporting] = useState(false);
  const params = { range, from, to };

  const { data: appointmentData, isLoading: appointmentsLoading } = useAppointmentAnalytics(clinicId, params, { trend: 'day' });
  const { data: queueData, isLoading: queueLoading } = useQueueAnalytics(clinicId, params);
  const { data: doctorRows, isLoading: doctorLoading } = useDoctorPerformance(clinicId, params);
  const myRow = doctorRows?.[0];

  async function handleExport() {
    if (!clinicId) return;
    setExporting(true);
    try {
      await downloadAnalyticsExport(clinicId, 'doctors', params, `my-performance-${clinicId}.csv`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not export the report');
    } finally {
      setExporting(false);
    }
  }

  const loading = clinicsLoading || appointmentsLoading || queueLoading || doctorLoading;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">My Analytics</h1>
          <p className="text-muted-foreground text-sm">Your own appointment, queue, and consultation performance.</p>
        </div>
        <div className="flex items-center gap-3">
          {activeClinics.length > 1 && (
            <Select value={clinicId} onValueChange={(value) => router.push(`/doctor/analytics?clinicId=${value}`)}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select a clinic" />
              </SelectTrigger>
              <SelectContent>
                {activeClinics.map((clinic) => (
                  <SelectItem key={clinic.clinicId} value={clinic.clinicId}>
                    {clinic.clinicName}
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
        <EmptyState title="No clinic associated" description="You are not associated with any clinic yet." />
      ) : loading || !myRow ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Appointments" value={myRow.appointments} />
            <KpiCard label="Completed" value={myRow.completed} />
            <KpiCard label="Cancelled" value={myRow.cancelled} />
            <KpiCard label="No-shows" value={myRow.noShow} />
            <KpiCard label="Avg. Consultation" value={formatMinutes(myRow.averageConsultationMinutes)} />
            <KpiCard label="Avg. Patient Wait" value={formatMinutes(myRow.averageWaitingMinutes)} />
            <KpiCard label="Avg. Delay" value={formatMinutes(myRow.averageDelayMinutes)} />
            <KpiCard label="Utilization" value={formatPercent(myRow.utilization)} hint={myRow.utilization === null ? 'No scheduled capacity for this period' : undefined} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Appointment Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendBarChart title="Appointments per day" points={appointmentData?.trend ?? []} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Queue Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Checked in</span>
                  <span className="font-medium">{queueData?.breakdown.checkedIn ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Called</span>
                  <span className="font-medium">{queueData?.breakdown.called ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completed</span>
                  <span className="font-medium">{queueData?.breakdown.completed ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Median waiting time</span>
                  <span className="font-medium">{formatMinutes(queueData?.breakdown.medianWaitingMinutes ?? null)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Reviews</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-6 text-sm">
              <div>
                <p className="text-muted-foreground">Average rating</p>
                <p className="text-2xl font-semibold">{myRow.averageRating ? myRow.averageRating.toFixed(1) : '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">New reviews in range</p>
                <p className="text-2xl font-semibold">{myRow.reviewCount}</p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default function DoctorAnalyticsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <DoctorAnalyticsContent />
    </Suspense>
  );
}
