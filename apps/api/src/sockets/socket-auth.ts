import type { Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt.js';
import { logger } from '../config/logger.js';

/**
 * Socket.IO middleware: verifies the JWT access token passed in the handshake
 * (`socket.handshake.auth.token`) and attaches the principal to `socket.data.user`.
 * Connections without a valid token are rejected before any event handlers run.
 */
export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void): void {
  const token = socket.handshake.auth?.token as string | undefined;

  if (!token) {
    next(new Error('Unauthorized: missing token'));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    socket.data.user = { id: payload.sub, role: payload.role, sessionId: payload.sessionId };
    next();
  } catch (err) {
    logger.warn({ err }, 'Socket authentication failed');
    next(new Error('Unauthorized: invalid token'));
  }
}
