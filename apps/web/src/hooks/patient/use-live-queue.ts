'use client';

import { useEffect } from 'react';
import { SOCKET_EVENTS } from '@clinic/shared';
import { useQueueSocket } from '@/hooks/use-queue-socket';
import { getQueueSocket } from '@/lib/socket-client';
import { useQueueView } from './use-appointments';

/**
 * Combines the initial REST snapshot with the existing /queue Socket.IO namespace (Phase 0)
 * for live updates. No queue module emits real events yet — `restQueue.isActive` stays false
 * until one does — but the subscription is real and will start reflecting live data the moment
 * a future queue module starts publishing `queue.updated` / `delay.updated` / `doctor.*` events
 * for this clinic, with no changes needed here.
 */
export function useLiveQueue(appointmentId: string | undefined, clinicId: string | undefined) {
  const { data: restQueue, isLoading, refetch } = useQueueView(appointmentId);
  const { isConnected } = useQueueSocket(clinicId);

  useEffect(() => {
    if (!clinicId) return;
    const socket = getQueueSocket();

    const handleUpdate = () => {
      // A real queue module would include a payload here; for now, just re-fetch the REST
      // snapshot so this stays correct once that payload exists, rather than guessing its shape.
      void refetch();
    };

    socket.on(SOCKET_EVENTS.QUEUE.UPDATED, handleUpdate);
    socket.on(SOCKET_EVENTS.DELAY.UPDATED, handleUpdate);
    socket.on(SOCKET_EVENTS.TOKEN.CALLED, handleUpdate);
    socket.on(SOCKET_EVENTS.DOCTOR.DELAYED, handleUpdate);
    socket.on(SOCKET_EVENTS.DOCTOR.ARRIVED, handleUpdate);

    return () => {
      socket.off(SOCKET_EVENTS.QUEUE.UPDATED, handleUpdate);
      socket.off(SOCKET_EVENTS.DELAY.UPDATED, handleUpdate);
      socket.off(SOCKET_EVENTS.TOKEN.CALLED, handleUpdate);
      socket.off(SOCKET_EVENTS.DOCTOR.DELAYED, handleUpdate);
      socket.off(SOCKET_EVENTS.DOCTOR.ARRIVED, handleUpdate);
    };
  }, [clinicId, refetch]);

  return { queue: restQueue, isLoading, isLiveConnected: isConnected };
}
