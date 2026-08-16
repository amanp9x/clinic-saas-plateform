import { describe, expect, it, afterAll } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { SOCKET_EVENTS, SOCKET_NAMESPACES } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createSocketServer } = await import('../../src/config/socket.js');
const { createPatientFixture } = await import('../helpers/doctor-fixtures.js');
const { notifyUser } = await import('../../src/modules/notifications/notification-dispatch.service.js');

const app = createApp();
const httpServer = createServer(app);
createSocketServer(httpServer);
await new Promise<void>((resolve) => httpServer.listen(0, resolve));
const port = (httpServer.address() as AddressInfo).port;

afterAll(() => {
  httpServer.close();
});

function connect(token: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(`http://127.0.0.1:${port}${SOCKET_NAMESPACES.QUEUE}`, {
      auth: { token },
      transports: ['websocket'],
    });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

describe('Real-time notification delivery over Socket.IO', () => {
  it('delivers notification.created to the authenticated user\'s own room, and no one else\'s', async () => {
    const recipient = await createPatientFixture(app);
    const stranger = await createPatientFixture(app);

    const recipientSocket = await connect(recipient.token);
    const strangerSocket = await connect(stranger.token);

    const received = new Promise<{ title: string; message: string }>((resolve) => {
      recipientSocket.on(SOCKET_EVENTS.NOTIFICATION.CREATED, resolve);
    });
    const strangerReceivedAnything = new Promise<boolean>((resolve) => {
      strangerSocket.on(SOCKET_EVENTS.NOTIFICATION.CREATED, () => resolve(true));
      setTimeout(() => resolve(false), 800);
    });

    await notifyUser({
      userId: recipient.userId,
      type: 'SYSTEM',
      title: 'Socket test notification',
      message: 'Hello over the wire',
      notificationKey: `test:socket:${recipient.userId}`,
    });

    const payload = await received;
    expect(payload.title).toBe('Socket test notification');
    expect(payload.message).toBe('Hello over the wire');
    expect(await strangerReceivedAnything).toBe(false);

    recipientSocket.disconnect();
    strangerSocket.disconnect();
  });

  it('emits an updated unread count alongside notification.created', async () => {
    const recipient = await createPatientFixture(app);
    const socket = await connect(recipient.token);

    const unreadCountPromise = new Promise<{ count: number }>((resolve) => {
      socket.on(SOCKET_EVENTS.NOTIFICATION.UNREAD_COUNT_UPDATED, resolve);
    });

    await notifyUser({
      userId: recipient.userId,
      type: 'SYSTEM',
      title: 'Unread count test',
      message: 'Checking unread count socket event',
      notificationKey: `test:unread-count:${recipient.userId}`,
    });

    const payload = await unreadCountPromise;
    expect(payload.count).toBeGreaterThanOrEqual(1);
    socket.disconnect();
  });
});
