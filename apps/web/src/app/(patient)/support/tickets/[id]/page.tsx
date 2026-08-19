'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { useSupportTicketDetail, useAddSupportTicketMessage, useWithdrawSupportTicket, useReopenSupportTicket } from '@/hooks/patient/use-support-tickets';
import { ApiError } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { SupportTicketStatus } from '@clinic/shared';

const STATUS_VARIANT: Record<SupportTicketStatus, 'secondary' | 'outline' | 'destructive'> = {
  OPEN: 'secondary',
  IN_PROGRESS: 'secondary',
  RESOLVED: 'outline',
  CLOSED: 'outline',
};

export default function SupportTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: ticket, isLoading } = useSupportTicketDetail(id);
  const addMessage = useAddSupportTicketMessage();
  const withdraw = useWithdrawSupportTicket();
  const reopen = useReopenSupportTicket();
  const [message, setMessage] = useState('');

  if (isLoading || !ticket) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  function sendMessage() {
    if (!message.trim()) return;
    addMessage.mutate(
      { id, message: message.trim() },
      {
        onSuccess: () => setMessage(''),
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not send message'),
      },
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/support/tickets" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-medium">
        <ArrowLeft className="size-4" />
        Back to support
      </Link>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-muted-foreground text-xs">{ticket.ticketNumber}</p>
              <CardTitle className="text-lg">{ticket.subject}</CardTitle>
              <p className="text-muted-foreground text-xs">{ticket.category.replace('_', ' ')} · Opened {formatDateTime(ticket.createdAt)}</p>
            </div>
            <Badge variant={STATUS_VARIANT[ticket.status]}>{ticket.status.replace('_', ' ')}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">{ticket.description}</p>

          {ticket.resolutionNotes && (
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium">Resolution</p>
              <p className="text-muted-foreground text-sm">{ticket.resolutionNotes}</p>
              {ticket.resolvedAt && <p className="text-muted-foreground mt-1 text-xs">Resolved {formatDateTime(ticket.resolvedAt)}</p>}
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t pt-4">
            {ticket.status === 'OPEN' && (
              <Button
                size="sm"
                variant="outline"
                disabled={withdraw.isPending}
                onClick={() =>
                  withdraw.mutate(id, {
                    onSuccess: () => toast.success('Ticket withdrawn'),
                    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not withdraw ticket'),
                  })
                }
              >
                Withdraw ticket
              </Button>
            )}
            {ticket.status === 'RESOLVED' && (
              <Button
                size="sm"
                variant="outline"
                disabled={reopen.isPending}
                onClick={() =>
                  reopen.mutate(id, {
                    onSuccess: () => toast.success('Ticket reopened'),
                    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not reopen ticket'),
                  })
                }
              >
                Not resolved — reopen
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ticket.messages.length === 0 ? (
            <p className="text-muted-foreground text-sm">No replies yet.</p>
          ) : (
            <div className="space-y-3">
              {ticket.messages.map((m) => (
                <div key={m.id} className={cn('max-w-[85%] rounded-lg border p-3', m.isFromAdmin ? 'bg-primary/5' : 'ml-auto bg-muted/40')}>
                  <p className="text-xs font-medium">{m.senderName}</p>
                  <p className="text-sm">{m.message}</p>
                  <p className="text-muted-foreground mt-1 text-xs">{formatDateTime(m.createdAt)}</p>
                </div>
              ))}
            </div>
          )}

          {ticket.status !== 'CLOSED' ? (
            <div className="space-y-2 border-t pt-4">
              <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Add a message…" />
              <Button size="sm" onClick={sendMessage} disabled={addMessage.isPending || !message.trim()}>
                {addMessage.isPending ? 'Sending…' : 'Send'}
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground border-t pt-4 text-xs">This ticket is closed and can no longer receive messages.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
