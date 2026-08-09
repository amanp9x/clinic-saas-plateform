import type { Namespace, Socket } from 'socket.io';
import { logger } from '../config/logger.js';
import { clinicRoom, isUserAuthorizedForClinic } from './clinic-access.js';
import { userRoom } from './emit.js';

/**
 * Registers connection handling for the /queue namespace. Doctor Portal services (Phase 4)
 * emit the actual queue/token/status events after a successful REST mutation — this file only
 * wires the join/leave/authorization skeleton plus the automatic per-user room join used for
 * notification delivery.
 */
export function registerQueueHandlers(namespace: Namespace): void {
  namespace.on('connection', (socket: Socket) => {
    const user = socket.data.user as { id: string; role: import('@clinic/shared').UserRole };
    logger.debug({ userId: user.id }, 'Client connected to /queue namespace');

    void socket.join(userRoom(user.id));

    socket.on(
      'queue:subscribe',
      async (payload: { clinicId?: string }, ack?: (res: unknown) => void) => {
        const clinicId = payload?.clinicId;
        if (!clinicId) {
          ack?.({ success: false, error: 'clinicId is required' });
          return;
        }

        const authorized = await isUserAuthorizedForClinic(user, clinicId);
        if (!authorized) {
          ack?.({ success: false, error: 'Not authorized for this clinic' });
          return;
        }

        await socket.join(clinicRoom(clinicId));
        ack?.({ success: true });
      },
    );

    socket.on('queue:unsubscribe', (payload: { clinicId?: string }) => {
      if (payload?.clinicId) {
        socket.leave(clinicRoom(payload.clinicId));
      }
    });

    socket.on('disconnect', (reason) => {
      logger.debug({ userId: user.id, reason }, 'Client disconnected from /queue namespace');
    });
  });
}
