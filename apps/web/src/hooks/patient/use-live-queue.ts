'use client';

import { useEffect } from 'react';
import { SOCKET_EVENTS } from '@clinic/shared';
import { useQueueSocket } from '@/hooks/use-queue-socket';
import { getQueueSocket } from '@/lib/socket-client';
import { useQueueView } from './use-appointments';

/**
 * Combines the initial REST snapshot with the existing /queue Socket.IO namespace for live
 * updates. The Doctor Portal (Phase 4) is the first module to actually emit these events — this
 * hook re-fetches the REST snapshot on every relevant event rather than trying to patch the
 * cache from a partial payload, since the snapshot shape is the same contract either way.
 */
export function useLiveQueue(appointmentId: string | undefined, clinicId: string | undefined) {
  const { data: restQueue, isLoading, refetch } = useQueueView(appointmentId);
  const { isConnected } = useQueueSocket(clinicId);

  useEffect(() => {
    if (!clinicId) return;
    const socket = getQueueSocket();

    const handleUpdate = () => {
      void refetch();
    };

    socket.on(SOCKET_EVENTS.QUEUE.UPDATED, handleUpdate);
    socket.on(SOCKET_EVENTS.DELAY.UPDATED, handleUpdate);
    socket.on(SOCKET_EVENTS.PATIENT.CALLED, handleUpdate);
    socket.on(SOCKET_EVENTS.PATIENT.SKIPPED, handleUpdate);
    socket.on(SOCKET_EVENTS.DOCTOR.STATUS_UPDATED, handleUpdate);
    socket.on(SOCKET_EVENTS.DOCTOR.SESSION_STARTED, handleUpdate);
    socket.on(SOCKET_EVENTS.DOCTOR.SESSION_PAUSED, handleUpdate);
    socket.on(SOCKET_EVENTS.DOCTOR.SESSION_RESUMED, handleUpdate);
    socket.on(SOCKET_EVENTS.APPOINTMENT.UPDATED, handleUpdate);

    return () => {
      socket.off(SOCKET_EVENTS.QUEUE.UPDATED, handleUpdate);
      socket.off(SOCKET_EVENTS.DELAY.UPDATED, handleUpdate);
      socket.off(SOCKET_EVENTS.PATIENT.CALLED, handleUpdate);
      socket.off(SOCKET_EVENTS.PATIENT.SKIPPED, handleUpdate);
      socket.off(SOCKET_EVENTS.DOCTOR.STATUS_UPDATED, handleUpdate);
      socket.off(SOCKET_EVENTS.DOCTOR.SESSION_STARTED, handleUpdate);
      socket.off(SOCKET_EVENTS.DOCTOR.SESSION_PAUSED, handleUpdate);
      socket.off(SOCKET_EVENTS.DOCTOR.SESSION_RESUMED, handleUpdate);
      socket.off(SOCKET_EVENTS.APPOINTMENT.UPDATED, handleUpdate);
    };
  }, [clinicId, refetch]);

  return { queue: restQueue, isLoading, isLiveConnected: isConnected };
}
