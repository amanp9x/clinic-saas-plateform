/**
 * Canonical Socket.IO event names shared by server emitters and client listeners.
 * Grouped by domain. Emitted by the Doctor Portal's and Reception Portal's REST mutation
 * services (both delegate to the shared queue engine — see `modules/queue-engine`) to the
 * clinic room (`clinic:<clinicId>`) or a user's own room (`user:<userId>`).
 */
export const SOCKET_EVENTS = {
  DOCTOR: {
    STATUS_UPDATED: 'doctor.status.updated',
    QUEUE_UPDATED: 'doctor.queue.updated',
    SESSION_STARTED: 'doctor.session.started',
    SESSION_PAUSED: 'doctor.session.paused',
    SESSION_RESUMED: 'doctor.session.resumed',
  },
  TOKEN: {
    CREATED: 'token.created',
    CALLED: 'token.called',
    REPEATED: 'token.repeated',
    SKIPPED: 'token.skipped',
  },
  PATIENT: {
    CHECKED_IN: 'patient.checked_in',
    CALLED: 'patient.called',
    SKIPPED: 'patient.skipped',
    IN_CONSULTATION: 'patient.in_consultation',
    COMPLETED: 'patient.completed',
  },
  CONSULTATION: {
    STARTED: 'consultation.started',
    COMPLETED: 'consultation.completed',
  },
  QUEUE: {
    UPDATED: 'queue.updated',
    PAUSED: 'queue.paused',
    RESUMED: 'queue.resumed',
  },
  DELAY: {
    UPDATED: 'delay.updated',
  },
  ETA: {
    UPDATED: 'eta.updated',
  },
  APPOINTMENT: {
    UPDATED: 'appointment.updated',
  },
  NOTIFICATION: {
    CREATED: 'notification.created',
  },
} as const;

/** Socket.IO namespaces. Clients join a clinic-scoped room after server-side authorization;
 * every authenticated connection also auto-joins its own user room (`user:<userId>`). */
export const SOCKET_NAMESPACES = {
  QUEUE: '/queue',
} as const;

export type SocketEventName =
  (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS][keyof (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS]];
