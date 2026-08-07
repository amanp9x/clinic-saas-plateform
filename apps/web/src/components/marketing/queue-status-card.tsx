import { Clock, Ticket, TimerReset, Users } from 'lucide-react';
import type { DoctorQueueStatus } from '@clinic/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/** Displays real queue data when a live-queue module is populating it (currently `isActive` is
 * always false — no queue module exists yet). Never fabricates a token/wait time. */
export function QueueStatusCard({ status }: { status: DoctorQueueStatus }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Live Queue Status</CardTitle>
        <Badge variant={status.isActive ? 'default' : 'secondary'}>
          {status.isActive ? 'Live' : 'Not started'}
        </Badge>
      </CardHeader>
      <CardContent>
        {status.isActive ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 divide-x rounded-lg border text-center">
              <div className="p-3">
                <Ticket className="text-muted-foreground mx-auto mb-1 size-4" />
                <p className="text-xl font-semibold">{status.currentToken}</p>
                <p className="text-muted-foreground text-xs">Current token</p>
              </div>
              <div className="p-3">
                <Users className="text-muted-foreground mx-auto mb-1 size-4" />
                <p className="text-xl font-semibold">{status.patientsAhead}</p>
                <p className="text-muted-foreground text-xs">Patients ahead</p>
              </div>
              <div className="p-3">
                <TimerReset className="text-muted-foreground mx-auto mb-1 size-4" />
                <p className="text-xl font-semibold">{status.estimatedWaitMinutes}m</p>
                <p className="text-muted-foreground text-xs">Est. wait</p>
              </div>
            </div>
            {status.delayMinutes !== null && status.delayMinutes > 0 && (
              <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
                <Clock className="size-4 shrink-0" />
                Running {status.delayMinutes} min late
                {status.delayReason ? ` — ${status.delayReason}` : ''}
              </p>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            This doctor&apos;s live queue hasn&apos;t started yet. Once clinic staff open
            today&apos;s session, you&apos;ll see the current token, patients ahead, and estimated
            wait time here — updated in real time.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
