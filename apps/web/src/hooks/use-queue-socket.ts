'use client';

import { useEffect, useState } from 'react';
import { getQueueSocket } from '@/lib/socket-client';

/**
 * Connects to the /queue Socket.IO namespace and subscribes to a clinic's room.
 * Live queue/token event handlers are added by the queue-tracking module later —
 * this hook only manages the connection + room lifecycle.
 */
export function useQueueSocket(clinicId: string | undefined) {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!clinicId) return;

    const socket = getQueueSocket();
    socket.connect();

    const handleConnect = () => {
      setIsConnected(true);
      socket.emit('queue:subscribe', { clinicId });
    };
    const handleDisconnect = () => setIsConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.emit('queue:unsubscribe', { clinicId });
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [clinicId]);

  return { isConnected };
}
