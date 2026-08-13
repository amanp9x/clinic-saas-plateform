'use client';

import { toast } from 'sonner';
import { Play, PhoneCall, Repeat, SkipForward, Radio, Stethoscope, CheckCircle2, UserX } from 'lucide-react';
import type { ReceptionQueueSnapshotDto, TokenPriority } from '@clinic/shared';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/marketing/empty-state';
import { DelayDialog } from './delay-dialog';
import { PauseDialog } from './pause-dialog';
import {
  useReceptionCallNext,
  useReceptionMarkCompleted,
  useReceptionMarkInConsultation,
  useReceptionMarkNoShow,
  useReceptionRepeatCall,
  useReceptionResumeQueue,
  useReceptionSkip,
  useReceptionUpdatePriority,
} from '@/hooks/reception/use-reception-queue';
import { ApiError } from '@/lib/api-client';
import { initials } from '@/lib/format';

const PRIORITY_VARIANT: Record<TokenPriority, 'destructive' | 'secondary' | 'outline' | 'default'> = {
  EMERGENCY: 'destructive',
  URGENT: 'secondary',
  FOLLOW_UP: 'outline',
  NORMAL: 'outline',
};

export function ReceptionQueueConsole({ clinicId, doctorId, queue, isConnected }: { clinicId: string; doctorId: string; queue: ReceptionQueueSnapshotDto; isConnected: boolean }) {
  const callNext = useReceptionCallNext(clinicId, doctorId);
  const repeatCall = useReceptionRepeatCall(clinicId, doctorId);
  const skip = useReceptionSkip(clinicId, doctorId);
  const resumeQueue = useReceptionResumeQueue(clinicId, doctorId);
  const updatePriority = useReceptionUpdatePriority(clinicId, doctorId);
  const markInConsultation = useReceptionMarkInConsultation(clinicId, doctorId);
  const markCompleted = useReceptionMarkCompleted(clinicId, doctorId);
  const markNoShow = useReceptionMarkNoShow(clinicId, doctorId);

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
            Queue Console
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={queueStatus === 'ACTIVE' ? 'default' : queueStatus === 'PAUSED' ? 'secondary' : 'outline'}>
              Queue {queueStatus === 'ACTIVE' ? 'Active' : queueStatus === 'PAUSED' ? 'Paused' : 'Closed'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {queueStatus === 'PAUSED' ? (
            <Button
              onClick={() => resumeQueue.mutate(undefined, { onSuccess: () => toast.success('Queue resumed'), onError: onError('Could not resume queue') })}
              disabled={resumeQueue.isPending}
            >
              <Play className="size-4" />
              Resume Queue
            </Button>
          ) : (
            <PauseDialog clinicId={clinicId} doctorId={doctorId} />
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
            {queue.pauseReason && queueStatus === 'PAUSED' && <span className="text-muted-foreground">Paused: {queue.pauseReason}</span>}
            {session?.delayMinutes ? (
              <span className="text-destructive">
                Delayed {session.delayMinutes} min{session.delayReason ? ` — ${session.delayReason}` : ''}
              </span>
            ) : (
              <span className="text-muted-foreground">No delay reported</span>
            )}
            {queue.canUpdateDelay && <DelayDialog clinicId={clinicId} doctorId={doctorId} currentDelayMinutes={session?.delayMinutes ?? null} />}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-4">
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
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Est. Wait (next patient)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{queue.estimatedWaitMinutes ?? '—'}{queue.estimatedWaitMinutes !== null && ' min'}</p>
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
                    {queue.currentToken.status} · Called {queue.currentToken.calledCount} time{queue.currentToken.calledCount === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {queue.currentToken.status === 'CALLED' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        repeatCall.mutate(queue.currentToken!.id, { onSuccess: () => toast.success('Patient re-called'), onError: onError('Could not re-call patient') })
                      }
                      disabled={repeatCall.isPending}
                    >
                      <Repeat className="size-4" />
                      Repeat Call
                    </Button>
                    {queue.currentToken.appointmentId && (
                      <Button
                        size="sm"
                        onClick={() =>
                          markInConsultation.mutate(queue.currentToken!.appointmentId!, {
                            onSuccess: () => toast.success('Consultation started'),
                            onError: onError('Could not start consultation'),
                          })
                        }
                        disabled={markInConsultation.isPending}
                      >
                        <Stethoscope className="size-4" />
                        Start Consultation
                      </Button>
                    )}
                    {queue.currentToken.appointmentId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          markNoShow.mutate(queue.currentToken!.appointmentId!, {
                            onSuccess: () => toast.success('Marked as no-show'),
                            onError: onError('Could not mark no-show'),
                          })
                        }
                        disabled={markNoShow.isPending}
                      >
                        <UserX className="size-4" />
                        No Show
                      </Button>
                    )}
                  </>
                )}
                {queue.currentToken.status === 'IN_CONSULTATION' && queue.currentToken.appointmentId && (
                  <Button
                    size="sm"
                    onClick={() =>
                      markCompleted.mutate(queue.currentToken!.appointmentId!, {
                        onSuccess: () => toast.success('Consultation completed'),
                        onError: onError('Could not complete consultation'),
                      })
                    }
                    disabled={markCompleted.isPending}
                  >
                    <CheckCircle2 className="size-4" />
                    Mark Completed
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
            <EmptyState title="No one waiting" description="Waiting patients will appear here in priority + token order." />
          ) : (
            <ul className="divide-y">
              {queue.waitingTokens.map((token, index) => (
                <li key={token.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground w-6 text-sm">{index + 1}</span>
                    <Avatar className="size-9">
                      <AvatarFallback>{initials(token.patientName)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">
                        Token #{token.tokenNumber} · {token.patientName}
                      </p>
                      <p className="text-muted-foreground text-xs capitalize">
                        {token.type.toLowerCase().replace('_', ' ')}
                        {token.etaMinutes !== null && ` · ETA ${token.etaMinutes} min`}
                      </p>
                    </div>
                    <Badge variant={PRIORITY_VARIANT[token.priority]}>{token.priority.replace('_', ' ')}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {queue.canUpdatePriority && (
                      <Select
                        value={token.priority}
                        onValueChange={(priority) =>
                          updatePriority.mutate(
                            { tokenId: token.id, priority: priority as TokenPriority },
                            { onSuccess: () => toast.success('Priority updated'), onError: onError('Could not update priority') },
                          )
                        }
                      >
                        <SelectTrigger className="h-8 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NORMAL">Normal</SelectItem>
                          <SelectItem value="FOLLOW_UP">Follow-up</SelectItem>
                          <SelectItem value="URGENT">Urgent</SelectItem>
                          <SelectItem value="EMERGENCY">Emergency</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        skip.mutate({ tokenId: token.id }, { onSuccess: () => toast.success('Patient skipped'), onError: onError('Could not skip patient') })
                      }
                      disabled={skip.isPending}
                    >
                      <SkipForward className="size-4" />
                      Skip
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
