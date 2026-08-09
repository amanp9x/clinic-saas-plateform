'use client';

import { toast } from 'sonner';
import Link from 'next/link';
import { Pause, Play, PhoneCall, Repeat, SkipForward, Radio } from 'lucide-react';
import type { QueueSnapshotDto } from '@clinic/shared';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/marketing/empty-state';
import { DoctorStatusBadge } from './doctor-status-badge';
import { DelayEditDialog } from './delay-edit-dialog';
import {
  useCallNextPatient,
  usePauseQueueSession,
  useRepeatCallPatient,
  useResumeQueueSession,
  useSkipQueuePatient,
  useStartQueueSession,
} from '@/hooks/doctor/use-doctor-queue';
import { ApiError } from '@/lib/api-client';
import { initials } from '@/lib/format';

export function QueueConsole({ clinicId, queue, isConnected }: { clinicId: string; queue: QueueSnapshotDto; isConnected: boolean }) {
  const startSession = useStartQueueSession(clinicId);
  const pauseSession = usePauseQueueSession(clinicId);
  const resumeSession = useResumeQueueSession(clinicId);
  const callNext = useCallNextPatient(clinicId);
  const repeatCall = useRepeatCallPatient(clinicId);
  const skip = useSkipQueuePatient(clinicId);

  const session = queue.session;
  const queueStatus = session?.queueStatus ?? 'CLOSED';

  function onError(fallback: string) {
    return (err: unknown) => toast.error(err instanceof ApiError ? err.message : fallback);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Radio className={isConnected ? 'size-4 text-emerald-500' : 'size-4 text-muted-foreground'} />
            Session Controls
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={queueStatus === 'ACTIVE' ? 'default' : queueStatus === 'PAUSED' ? 'secondary' : 'outline'}>
              Queue {queueStatus === 'ACTIVE' ? 'Active' : queueStatus === 'PAUSED' ? 'Paused' : 'Closed'}
            </Badge>
            {session && <DoctorStatusBadge status={session.status} />}
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {queueStatus !== 'ACTIVE' ? (
            <Button
              onClick={() => startSession.mutate(undefined, { onSuccess: () => toast.success('Queue session started'), onError: onError('Could not start session') })}
              disabled={startSession.isPending}
            >
              <Play className="size-4" />
              {queueStatus === 'PAUSED' ? 'Resume via Start' : 'Start Session'}
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => pauseSession.mutate(undefined, { onSuccess: () => toast.success('Queue paused'), onError: onError('Could not pause queue') })}
              disabled={pauseSession.isPending}
            >
              <Pause className="size-4" />
              Pause Queue
            </Button>
          )}
          {queueStatus === 'PAUSED' && (
            <Button
              onClick={() => resumeSession.mutate(undefined, { onSuccess: () => toast.success('Queue resumed'), onError: onError('Could not resume queue') })}
              disabled={resumeSession.isPending}
            >
              <Play className="size-4" />
              Resume Queue
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => callNext.mutate(undefined, { onSuccess: () => toast.success('Next patient called'), onError: onError('Could not call next patient') })}
            disabled={callNext.isPending || queueStatus !== 'ACTIVE'}
          >
            <PhoneCall className="size-4" />
            Call Next Patient
          </Button>

          <div className="ml-auto flex items-center gap-3 text-sm">
            {session?.delayMinutes ? (
              <span className="text-destructive">
                Delayed {session.delayMinutes} min{session.delayReason ? ` — ${session.delayReason}` : ''}
              </span>
            ) : (
              <span className="text-muted-foreground">No delay reported</span>
            )}
            {queue.canOverrideDelay && <DelayEditDialog clinicId={clinicId} session={session} />}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Queue Length</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{queue.queueLength}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Completed Today</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{queue.completedTodayCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Skipped Today</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{queue.skippedTodayCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Patient</CardTitle>
        </CardHeader>
        <CardContent>
          {queue.currentToken ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="size-11">
                  <AvatarFallback>{initials(queue.currentToken.patientName)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">
                    Token #{queue.currentToken.tokenNumber} · {queue.currentToken.patientName}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Called {queue.currentToken.calledCount} time{queue.currentToken.calledCount === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    repeatCall.mutate(queue.currentToken!.id, {
                      onSuccess: () => toast.success('Patient re-called'),
                      onError: onError('Could not re-call patient'),
                    })
                  }
                  disabled={repeatCall.isPending}
                >
                  <Repeat className="size-4" />
                  Repeat Call
                </Button>
                {queue.currentToken.appointmentId && (
                  <Button size="sm" render={<Link href={`/doctor/appointments/${queue.currentToken.appointmentId}`} />}>
                    Open Appointment
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <EmptyState title="No patient currently called" description="Call the next patient to begin their consultation." />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Waiting Patients ({queue.waitingTokens.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {queue.waitingTokens.length === 0 ? (
            <EmptyState title="No one waiting" description="Waiting patients will appear here in token order." />
          ) : (
            <ul className="divide-y">
              {queue.waitingTokens.map((token, index) => (
                <li key={token.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground w-6 text-sm">{index + 1}</span>
                    <Avatar className="size-9">
                      <AvatarFallback>{initials(token.patientName)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">
                        Token #{token.tokenNumber} · {token.patientName}
                      </p>
                      <p className="text-muted-foreground text-xs capitalize">{token.type.toLowerCase().replace('_', ' ')}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      skip.mutate(
                        { tokenId: token.id },
                        { onSuccess: () => toast.success('Patient skipped'), onError: onError('Could not skip patient') },
                      )
                    }
                    disabled={skip.isPending}
                  >
                    <SkipForward className="size-4" />
                    Skip
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
