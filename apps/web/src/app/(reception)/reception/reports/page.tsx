'use client';

import { Suspense, useState } from 'react';
import { useSelectedClinic } from '@/hooks/reception/use-selected-clinic';
import { useReceptionReports } from '@/hooks/reception/use-reception-reports';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function ReportsContent() {
  const { clinicId, isLoading: clinicLoading } = useSelectedClinic();
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const { data: report, isLoading } = useReceptionReports(clinicId, from, to);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Reports</h1>
        <p className="text-muted-foreground text-sm">Queue efficiency, delays, and doctor punctuality for a date range.</p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="from">From</Label>
          <input
            id="from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border-input bg-background flex h-9 rounded-md border px-3 py-1 text-sm shadow-xs"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="to">To</Label>
          <input
            id="to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border-input bg-background flex h-9 rounded-md border px-3 py-1 text-sm shadow-xs"
          />
        </div>
      </div>

      {clinicLoading || isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !clinicId ? (
        <EmptyState title="No clinic associated" description="You are not assigned to any clinic yet." />
      ) : report ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {[
              { label: 'Total Appointments', value: report.totalAppointments },
              { label: 'Checked In', value: report.checkedInCount },
              { label: 'Walk-ins', value: report.walkInsCount },
              { label: 'No-shows', value: report.noShowCount },
              { label: 'Avg Wait (min)', value: report.averageWaitMinutes ?? '—' },
              { label: 'Avg Consultation (min)', value: report.averageConsultationMinutes ?? '—' },
              { label: 'Total Delay (min)', value: report.totalDelayMinutes },
              { label: 'Queue Efficiency', value: report.queueEfficiencyPercent !== null ? `${report.queueEfficiencyPercent}%` : '—' },
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
              <CardTitle>Doctor Punctuality</CardTitle>
            </CardHeader>
            <CardContent>
              {report.doctorPunctuality.length === 0 ? (
                <EmptyState title="No data" description="No sessions recorded for this date range." />
              ) : (
                <ul className="divide-y">
                  {report.doctorPunctuality.map((d) => (
                    <li key={d.doctorId} className="flex items-center justify-between py-3 text-sm">
                      <span className="font-medium">{d.doctorName}</span>
                      <span className="text-muted-foreground">
                        Avg delay {d.averageDelayMinutes ?? '—'} min · On-time {d.onTimeRate !== null ? `${d.onTimeRate}%` : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Peak Hours</CardTitle>
            </CardHeader>
            <CardContent>
              {report.peakHours.length === 0 ? (
                <EmptyState title="No data" description="No appointments recorded for this date range." />
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {report.peakHours.map((p) => (
                    <li key={p.hour} className="rounded-md border px-3 py-1.5 text-sm">
                      {p.hour}:00 — {p.count} appt{p.count === 1 ? '' : 's'}
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

export default function ReceptionReportsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ReportsContent />
    </Suspense>
  );
}
