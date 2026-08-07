import { io, type Socket } from 'socket.io-client';
import { SOCKET_NAMESPACES } from '@clinic/shared';
import { clientEnv } from './env';
import { tokenStore } from './token-store';

let queueSocket: Socket | null = null;

/** Lazily creates (or returns) the singleton socket for the /queue namespace. */
export function getQueueSocket(): Socket {
  queueSocket ??= io(`${clientEnv.socketUrl}${SOCKET_NAMESPACES.QUEUE}`, {
    autoConnect: false,
    withCredentials: true,
    auth: (cb) => cb({ token: tokenStore.get() }),
  });
  return queueSocket;
}

export function disconnectQueueSocket(): void {
  queueSocket?.disconnect();
  queueSocket = null;
}
