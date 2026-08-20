'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import type { ContactMessageStatus } from '@clinic/shared';
import { usePlatformContactMessageDetail, useUpdateContactMessageStatus } from '@/hooks/platform-admin/use-platform-contact-messages';
import { ApiError } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

const TRANSITIONS: Record<ContactMessageStatus, ('IN_PROGRESS' | 'RESOLVED')[]> = {
  NEW: ['IN_PROGRESS', 'RESOLVED'],
  IN_PROGRESS: ['RESOLVED'],
  RESOLVED: [],
};

const STATUS_VARIANT: Record<ContactMessageStatus, 'secondary' | 'outline'> = {
  NEW: 'secondary',
  IN_PROGRESS: 'secondary',
  RESOLVED: 'outline',
};

export default function PlatformAdminContactMessageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: message, isLoading } = usePlatformContactMessageDetail(id);
  const updateStatus = useUpdateContactMessageStatus();
  const [reply, setReply] = useState('');

  if (isLoading || !message) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  function act(status: 'IN_PROGRESS' | 'RESOLVED') {
    updateStatus.mutate(
      { id, status, adminReply: reply.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(status === 'RESOLVED' ? 'Marked resolved' : 'Marked in progress');
          setReply('');
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update message'),
      },
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/platform-admin/contact-messages" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-medium">
        <ArrowLeft className="size-4" />
        Back to messages
      </Link>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-muted-foreground text-xs">
                {message.name} · {message.email}
                {message.phone ? ` · ${message.phone}` : ''}
              </p>
              <CardTitle className="text-lg">{message.subject}</CardTitle>
              <p className="text-muted-foreground text-xs">Received {formatDateTime(message.createdAt)}</p>
            </div>
            <Badge variant={STATUS_VARIANT[message.status]}>{message.status.replace('_', ' ')}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm whitespace-pre-wrap">{message.message}</p>

          {message.adminReply && (
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium">Reply sent</p>
              <p className="text-muted-foreground text-sm whitespace-pre-wrap">{message.adminReply}</p>
              {message.respondedAt && <p className="text-muted-foreground mt-1 text-xs">Sent {formatDateTime(message.respondedAt)}</p>}
            </div>
          )}

          {TRANSITIONS[message.status].length > 0 ? (
            <div className="space-y-3 border-t pt-4">
              <Textarea
                rows={4}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Optional email reply to the sender (leave blank to update status without replying)…"
              />
              <div className="flex flex-wrap gap-2">
                {TRANSITIONS[message.status].map((target) => (
                  <Button key={target} size="sm" variant={target === 'RESOLVED' ? 'default' : 'outline'} disabled={updateStatus.isPending} onClick={() => act(target)}>
                    {updateStatus.isPending ? 'Saving…' : target === 'RESOLVED' ? (reply.trim() ? 'Reply & resolve' : 'Mark resolved') : 'Mark in progress'}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground border-t pt-4 text-xs">This message has been resolved.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
