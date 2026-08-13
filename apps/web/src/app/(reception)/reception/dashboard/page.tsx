'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type { DoctorSessionStatus } from '@clinic/shared';
import { useSelectedClinic } from '@/hooks/reception/use-selected-clinic';
import { useReceptionDashboard, useReceptionDashboardLive } from '@/hooks/reception/use-reception-dashboard';
import { useReceptionUpdateDoctorStatus } from '@/hooks/reception/use-reception-doctors';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/marketing/empty-state';
import { Radio } from 'lucide-react';
import { ApiError } from '@/lib/api-client';

const STATUS_OPTIONS: DoctorSessionStatus[] = ['NOT_ARRIVED', 'ARRIVED', 'AVAILABLE', 'ON_BREAK', 'DELAYED', 'UNAVAILABLE', 'SESSION_ENDED'];

function DashboardContent() {
  const router = useRouter();
  const { clinics, clinicId, isLoading: clinicsLoading } = useSelectedClinic();
  const { data: summary, isLoading } = useReceptionDashboard(clinicId);
  const { isConnected } = useReceptionDashboardLive(clinicId);
  const updateStatus = useReceptionUpdateDoctorStatus(clinicId);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading flex items-center gap-2 text-2xl font-semibold">
            <Radio className={isConnected ? 'size-5 text-emerald-500' : 'size-5 text-muted-foreground'} />
            Reception Dashboard
          </h1>
          <p className="text-muted-foreground text-sm">Live overview of today&apos;s appointments, check-ins, and queues.</p>
        </div>
        {clinics.length > 1 && (
          <Select value={clinicId} onValueChange={(value) => router.push(`/reception/dashboard?clinicId=${value}`)}>
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

      {clinicsLoading || isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : !clinicId ? (
        <EmptyState title="No clinic associated" description="You are not assigned to any clinic yet." />
      ) : summary ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {[
              { label: "Today's Appointments", value: summary.todayTotalAppointments },
              { label: 'Checked In', value: summary.checkedInCount },
              { label: 'Waiting', value: summary.waitingCount },
              { label: 'In Consultation', value: summary.inConsultationCount },
              { label: 'Completed', value: summary.completedCount },
              { label: 'No-shows', value: summary.noShowCount },
              { label: 'Walk-ins', value: summary.walkInsCount },
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
              <CardTitle>Doctor Queues</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {summary.doctorQueues.length === 0 ? (
                <EmptyState title="No doctors at this clinic" description="Doctors associated with this clinic will appear here." />
              ) : (
                summary.doctorQueues.map((d) => (
                  <div key={d.doctorId} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <Link href={`/reception/queue?doctorId=${d.doctorId}`} className="font-medium hover:underline">
                        {d.doctorName}
                      </Link>
                      <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant={d.queueStatus === 'ACTIVE' ? 'default' : d.queueStatus === 'PAUSED' ? 'secondary' : 'outline'}>
                          Queue {d.queueStatus}
                        </Badge>
                        <span>{d.queueSize} waiting</span>
                        {d.currentTokenNumber !== null && <span>· Current #{d.currentTokenNumber}</span>}
                        {d.estimatedWaitMinutes !== null && <span>· ETA {d.estimatedWaitMinutes} min</span>}
                        {d.delayMinutes ? <span className="text-destructive">· Delayed {d.delayMinutes} min</span> : null}
                      </div>
                    </div>
                    <Select
                      value={d.status}
                      onValueChange={(status) =>
                        updateStatus.mutate(
                          { doctorId: d.doctorId, status: status as DoctorSessionStatus },
                          { onSuccess: () => toast.success('Doctor status updated'), onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update status') },
                        )
                      }
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s.replace('_', ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

export default function ReceptionDashboardPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <DashboardContent />
    </Suspense>
  );
}
