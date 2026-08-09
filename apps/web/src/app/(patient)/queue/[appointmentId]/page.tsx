'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, MapPin, Radio, Stethoscope, Timer, Users } from 'lucide-react';
import { useLiveQueue } from '@/hooks/patient/use-live-queue';
import { useAppointment } from '@/hooks/patient/use-appointments';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, formatRelativeTime } from '@/lib/format';

function QueueStat({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-4" />
      </span>
      <div>
        <p className="text-lg font-semibold leading-tight">{value}</p>
        <p className="text-muted-foreground text-xs">{label}</p>
      </div>
    </div>
  );
}

export default function LiveQueuePage({ params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = use(params);
  const { data: appointment, isLoading: isAppointmentLoading } = useAppointment(appointmentId);
  const { queue, isLoading: isQueueLoading, isLiveConnected } = useLiveQueue(appointmentId, appointment?.clinicId);

  const isLoading = isAppointmentLoading || isQueueLoading;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!queue) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-muted-foreground text-sm">Queue information isn&apos;t available for this appointment.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/appointments/${appointmentId}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-medium"
      >
        <ArrowLeft className="size-4" />
        Back to appointment
      </Link>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Radio className="size-4" />
              Live Queue
            </CardTitle>
            <Badge variant={isLiveConnected ? 'secondary' : 'outline'}>
              {isLiveConnected ? 'Connected' : 'Connecting…'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <Stethoscope className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <div>
                <p className="text-sm font-medium">{queue.doctorName}</p>
                <p className="text-muted-foreground text-xs">Doctor</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <div>
                <p className="text-sm font-medium">{queue.clinicName}</p>
                <p className="text-muted-foreground text-xs">Clinic</p>
              </div>
            </div>
            <div className="flex items-start gap-2 sm:col-span-2">
              <Clock className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <div>
                <p className="text-sm font-medium">{formatDateTime(queue.appointmentTime)}</p>
                <p className="text-muted-foreground text-xs">Appointment time</p>
              </div>
            </div>
          </div>

          {queue.isActive ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <QueueStat icon={Timer} label="Current token" value={queue.currentToken ?? '—'} />
                <QueueStat icon={Timer} label="Your token" value={queue.patientToken ?? '—'} />
                <QueueStat
                  icon={Users}
                  label="Patients ahead of you"
                  value={queue.patientsAhead !== null ? String(queue.patientsAhead) : '—'}
                />
                <QueueStat
                  icon={Clock}
                  label="Estimated wait"
                  value={queue.estimatedWaitMinutes !== null ? `${queue.estimatedWaitMinutes} min` : '—'}
                />
              </div>

              {queue.queueProgressPercent !== null && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Queue progress</span>
                    <span className="font-medium">{queue.queueProgressPercent}%</span>
                  </div>
                  <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full transition-all"
                      style={{ width: `${queue.queueProgressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {(queue.delayMinutes ?? 0) > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    Running {queue.delayMinutes} min behind schedule
                  </p>
                  {queue.delayReason && (
                    <p className="text-muted-foreground text-sm">{queue.delayReason}</p>
                  )}
                </div>
              )}

              {queue.doctorStatus && (
                <p className="text-muted-foreground text-sm">Doctor status: {queue.doctorStatus}</p>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-center">
              <p className="text-sm font-medium">Live tracking hasn&apos;t started yet</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Your token{queue.patientToken ? ` (#${queue.patientToken})` : ''} is reserved. Live queue
                position, wait time, and delays will appear here once the clinic starts today&apos;s queue.
              </p>
            </div>
          )}

          <p className="text-muted-foreground text-right text-xs">
            Last updated {formatRelativeTime(queue.lastUpdatedAt)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
