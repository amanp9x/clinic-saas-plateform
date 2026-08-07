/**
 * Canonical Socket.IO event names shared by server emitters and client listeners.
 * Grouped by domain. Payload shapes are intentionally minimal in Phase 0 — the
 * live queue module will extend these once queue/token entities exist.
 */
export const SOCKET_EVENTS = {
  QUEUE: {
    UPDATED: 'queue.updated',
    PAUSED: 'queue.paused',
    RESUMED: 'queue.resumed',
  },
  TOKEN: {
    CREATED: 'token.created',
    CALLED: 'token.called',
    SKIPPED: 'token.skipped',
    COMPLETED: 'token.completed',
  },
  PATIENT: {
    CHECKED_IN: 'patient.checked_in',
    NO_SHOW: 'patient.no_show',
  },
  DOCTOR: {
    ARRIVED: 'doctor.arrived',
    AVAILABLE: 'doctor.available',
    DELAYED: 'doctor.delayed',
    UNAVAILABLE: 'doctor.unavailable',
  },
  CONSULTATION: {
    STARTED: 'consultation.started',
    COMPLETED: 'consultation.completed',
  },
  DELAY: {
    UPDATED: 'delay.updated',
  },
  APPOINTMENT: {
    UPDATED: 'appointment.updated',
  },
  ETA: {
    UPDATED: 'eta.updated',
  },
  NOTIFICATION: {
    CREATED: 'notification.created',
  },
} as const;

/** Socket.IO namespaces. Clients join a clinic-scoped room after server-side authorization. */
export const SOCKET_NAMESPACES = {
  QUEUE: '/queue',
} as const;

export type SocketEventName =
  (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS][keyof (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS]];
