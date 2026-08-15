'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelectedClinic } from '@/hooks/clinic/use-selected-clinic';
import { useClinicReports } from '@/hooks/clinic/use-clinic-reports';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function ReportsContent() {
  const router = useRouter();
  const { clinics, clinicId, isLoading: clinicsLoading } = useSelectedClinic();
  const [from, setFrom] = useState(daysAgoIso(7));
  const [to, setTo] = useState(todayIso());
  const { data: report, isLoading } = useClinicReports(clinicId, from, to);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Reports</h1>
          <p className="text-muted-foreground text-sm">Appointments, consultations, delays, and revenue for a date range.</p>
        </div>
        {clinics.length > 1 && (
          <Select value={clinicId} onValueChange={(value) => value && router.push(`/clinic/reports?clinicId=${value}`)}>
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
      </div>

      {clinicsLoading || isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !clinicId ? (
        <EmptyState title="No clinic associated" description="You are not assigned to any clinic yet." />
      ) : report ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {[
              { label: 'Total Appointments', value: report.totalAppointments },
              { label: 'Completed', value: report.completedConsultations },
              { label: 'Cancelled', value: report.cancelledAppointments },
              { label: 'No-shows', value: report.noShows },
              { label: 'Walk-ins', value: report.walkIns },
              { label: 'Avg Wait (min)', value: report.averageWaitMinutes ?? '—' },
              { label: 'Avg Consultation (min)', value: report.averageConsultationMinutes ?? '—' },
              { label: 'Total Delay (min)', value: report.totalDelayMinutes },
              { label: 'Revenue', value: `₹${report.revenue}` },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardHeader>
                  <CardTitle className="text-muted-foreground text-sm">{stat.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Doctor Utilization</CardTitle>
            </CardHeader>
            <CardContent>
              {report.doctorUtilization.length === 0 ? (
                <EmptyState title="No data" description="No sessions recorded for this date range." />
              ) : (
                <ul className="divide-y">
                  {report.doctorUtilization.map((d) => (
                    <li key={d.doctorId} className="flex items-center justify-between py-3 text-sm">
                      <span className="font-medium">{d.doctorName}</span>
                      <span className="text-muted-foreground">Avg delay {d.averageDelayMinutes ?? '—'} min</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

export default function ClinicReportsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ReportsContent />
    </Suspense>
  );
}
