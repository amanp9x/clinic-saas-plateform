'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { SOCKET_EVENTS, type NotificationDto } from '@clinic/shared';
import { getQueueSocket } from '@/lib/socket-client';

/**
 * Real-time notification delivery over the existing /queue Socket.IO namespace — every
 * authenticated connection is auto-joined to its own `user:<id>` room server-side (see
 * sockets/queue.socket.ts), so no explicit subscribe call is needed here, unlike the
 * clinic-room-scoped queue events. Shared by patient/doctor/reception bells — only the React
 * Query key prefix differs per portal.
 */
export function useNotificationSocket(queryKeyPrefix: readonly unknown[]) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getQueueSocket();
    socket.connect();

    const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeyPrefix });
    const onCreated = (notification: NotificationDto) => {
      invalidate();
      toast(notification.title, { description: notification.message });
    };

    socket.on(SOCKET_EVENTS.NOTIFICATION.CREATED, onCreated);
    socket.on(SOCKET_EVENTS.NOTIFICATION.READ, invalidate);
    socket.on(SOCKET_EVENTS.NOTIFICATION.UNREAD_COUNT_UPDATED, invalidate);

    return () => {
      socket.off(SOCKET_EVENTS.NOTIFICATION.CREATED, onCreated);
      socket.off(SOCKET_EVENTS.NOTIFICATION.READ, invalidate);
      socket.off(SOCKET_EVENTS.NOTIFICATION.UNREAD_COUNT_UPDATED, invalidate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- queryKeyPrefix is a stable literal per call site
  }, [queryClient]);
}
