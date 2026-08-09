import type { Namespace } from 'socket.io';
import { clinicRoom } from './clinic-access.js';

/**
 * Set once at server startup by `createSocketServer`. Services that need to broadcast a live
 * update (Doctor Portal mutations) import the functions below rather than reaching for the
 * namespace directly, so the "how do I reach a socket" question has one answer.
 */
let queueNamespace: Namespace | null = null;

export function setQueueNamespace(namespace: Namespace): void {
  queueNamespace = namespace;
}

export function userRoom(userId: string): string {
  return `user:${userId}`;
}

/** Broadcasts to everyone subscribed to a clinic's live room (doctors, staff, and patients who
 * joined via `queue:subscribe`). No-op if the socket server hasn't started (e.g. in tests). */
export function emitToClinicRoom(clinicId: string, event: string, payload: unknown): void {
  queueNamespace?.to(clinicRoom(clinicId)).emit(event, payload);
}

/** Broadcasts to a single user's own room, auto-joined on connection — used for notifications
 * that aren't scoped to any one clinic. */
export function emitToUserRoom(userId: string, event: string, payload: unknown): void {
  queueNamespace?.to(userRoom(userId)).emit(event, payload);
}
