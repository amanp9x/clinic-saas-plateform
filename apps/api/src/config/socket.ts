import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { SOCKET_NAMESPACES } from '@clinic/shared';
import { env } from './env.js';
import { socketAuthMiddleware } from '../sockets/socket-auth.js';
import { registerQueueHandlers } from '../sockets/queue.socket.js';

export function createSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: env.CORS_ORIGIN, credentials: true },
  });

  const queueNamespace = io.of(SOCKET_NAMESPACES.QUEUE);
  queueNamespace.use(socketAuthMiddleware);
  registerQueueHandlers(queueNamespace);

  return io;
}
