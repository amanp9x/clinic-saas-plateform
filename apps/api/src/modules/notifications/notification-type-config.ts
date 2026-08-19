import type { NotificationPriority, NotificationType } from '@prisma/client';

/** Not a persisted column (nothing in the data model needs to query "all SECURITY-tier
 * notifications"), so this is a plain application-level type rather than a Prisma enum —
 * tier is looked up from `type` via this table, never stored per-row. */
export type NotificationTier = 'TRANSACTIONAL' | 'SECURITY' | 'OPTIONAL';

/** Which NotificationPreference columns (see schema) a given type is gated by. 'none' means the
 * type is never suppressible via preference (either because its tier already bypasses preferences
 * entirely, or because no toggle exists for it — e.g. reviews). */
export type NotificationCategory = 'appointment' | 'payment' | 'queue' | 'prescription' | 'announcement' | 'none';

export interface NotificationTypeConfig {
  tier: NotificationTier;
  category: NotificationCategory;
  priority: NotificationPriority;
  /** Minutes after creation this notification becomes stale and should stop being surfaced as
   * "current" in the UI (e.g. a delay update once the appointment has long since passed). */
  defaultExpiryMinutes?: number;
}

/**
 * The single routing table every dispatched notification is looked up against — this is the
 * "Preference / Permission Check" + "Template" step of the architecture diagram. No call site
 * decides tier/category/priority itself; they all flow from here, keyed by `type`.
 */
export const NOTIFICATION_TYPE_CONFIG: Record<NotificationType, NotificationTypeConfig> = {
  // Legacy (pre-Phase-10) — kept OPTIONAL/appointment-ish defaults for backward compatibility.
  APPOINTMENT_UPDATE: { tier: 'OPTIONAL', category: 'appointment', priority: 'NORMAL' },
  QUEUE_UPDATE: { tier: 'OPTIONAL', category: 'queue', priority: 'NORMAL' },
  PRESCRIPTION_READY: { tier: 'TRANSACTIONAL', category: 'prescription', priority: 'NORMAL' },
  REPORT_READY: { tier: 'OPTIONAL', category: 'prescription', priority: 'NORMAL' },
  SYSTEM: { tier: 'TRANSACTIONAL', category: 'none', priority: 'NORMAL' },

  APPOINTMENT_BOOKED: { tier: 'TRANSACTIONAL', category: 'appointment', priority: 'NORMAL' },
  APPOINTMENT_CONFIRMED: { tier: 'TRANSACTIONAL', category: 'appointment', priority: 'NORMAL' },
  APPOINTMENT_RESCHEDULED: { tier: 'TRANSACTIONAL', category: 'appointment', priority: 'NORMAL' },
  APPOINTMENT_CANCELLED: { tier: 'TRANSACTIONAL', category: 'appointment', priority: 'NORMAL' },
  APPOINTMENT_CHECKED_IN: { tier: 'OPTIONAL', category: 'queue', priority: 'NORMAL', defaultExpiryMinutes: 360 },
  APPOINTMENT_NO_SHOW: { tier: 'TRANSACTIONAL', category: 'appointment', priority: 'NORMAL' },
  APPOINTMENT_REMINDER: { tier: 'OPTIONAL', category: 'appointment', priority: 'NORMAL', defaultExpiryMinutes: 60 * 30 },
  APPOINTMENT_STARTING_SOON: { tier: 'OPTIONAL', category: 'appointment', priority: 'HIGH', defaultExpiryMinutes: 120 },

  PAYMENT_PENDING: { tier: 'TRANSACTIONAL', category: 'payment', priority: 'NORMAL' },
  PAYMENT_SUCCESS: { tier: 'TRANSACTIONAL', category: 'payment', priority: 'NORMAL' },
  PAYMENT_FAILED: { tier: 'TRANSACTIONAL', category: 'payment', priority: 'HIGH' },
  PAYMENT_REFUNDED: { tier: 'TRANSACTIONAL', category: 'payment', priority: 'NORMAL' },
  PAYMENT_REFUND_PENDING: { tier: 'TRANSACTIONAL', category: 'payment', priority: 'NORMAL' },

  QUEUE_CHECKED_IN: { tier: 'OPTIONAL', category: 'queue', priority: 'NORMAL', defaultExpiryMinutes: 360 },
  PATIENT_CALLED: { tier: 'OPTIONAL', category: 'queue', priority: 'HIGH', defaultExpiryMinutes: 60 },
  PATIENT_SKIPPED: { tier: 'OPTIONAL', category: 'queue', priority: 'NORMAL', defaultExpiryMinutes: 120 },
  QUEUE_DELAY_UPDATED: { tier: 'OPTIONAL', category: 'queue', priority: 'HIGH', defaultExpiryMinutes: 180 },
  DOCTOR_DELAYED: { tier: 'OPTIONAL', category: 'queue', priority: 'HIGH', defaultExpiryMinutes: 180 },
  DOCTOR_ON_TIME: { tier: 'OPTIONAL', category: 'queue', priority: 'NORMAL', defaultExpiryMinutes: 180 },
  QUEUE_PAUSED: { tier: 'OPTIONAL', category: 'queue', priority: 'NORMAL', defaultExpiryMinutes: 180 },
  QUEUE_RESUMED: { tier: 'OPTIONAL', category: 'queue', priority: 'NORMAL', defaultExpiryMinutes: 180 },

  CONSULTATION_STARTED: { tier: 'OPTIONAL', category: 'queue', priority: 'NORMAL', defaultExpiryMinutes: 180 },
  CONSULTATION_COMPLETED: { tier: 'OPTIONAL', category: 'appointment', priority: 'NORMAL' },

  DOCTOR_STATUS_CHANGED: { tier: 'OPTIONAL', category: 'queue', priority: 'LOW', defaultExpiryMinutes: 360 },

  CLINIC_ANNOUNCEMENT: { tier: 'OPTIONAL', category: 'announcement', priority: 'NORMAL' },

  REVIEW_RECEIVED: { tier: 'OPTIONAL', category: 'none', priority: 'LOW' },
  REVIEW_RESPONSE: { tier: 'OPTIONAL', category: 'none', priority: 'LOW' },
  REVIEW_HIDDEN: { tier: 'OPTIONAL', category: 'none', priority: 'NORMAL' },

  // Phase 13 — Appointment Waitlist. TRANSACTIONAL (not suppressible) and HIGH priority: this is a
  // time-sensitive "act now or someone else gets it" event, the same urgency class as
  // PAYMENT_FAILED — never something a patient would want silently dropped by a preference toggle.
  WAITLIST_SLOT_AVAILABLE: { tier: 'TRANSACTIONAL', category: 'appointment', priority: 'HIGH' },

  // Phase 14 — Follow-Up Care. OPTIONAL (suppressible via the existing appointment-category
  // preference toggle), matching APPOINTMENT_REMINDER's tier exactly — this is a helpful nudge,
  // not a transactional record of something that already happened.
  FOLLOW_UP_DUE: { tier: 'OPTIONAL', category: 'appointment', priority: 'NORMAL', defaultExpiryMinutes: 60 * 24 * 14 },

  // Phase 15 — Platform Admin. TRANSACTIONAL: a clinic's ability to operate/appear in the catalog
  // hinges on this, so it must never be suppressible via a preference toggle — same reasoning as
  // PAYMENT_FAILED and WAITLIST_SLOT_AVAILABLE.
  CLINIC_VERIFICATION_UPDATED: { tier: 'TRANSACTIONAL', category: 'none', priority: 'HIGH' },

  // Phase 17 — Compliance & Renewal. TRANSACTIONAL, HIGH priority: an expiring/expired
  // registration or license is a real compliance risk, not something a clinic admin should be
  // able to silently mute via a preference toggle — same reasoning as CLINIC_VERIFICATION_UPDATED.
  CLINIC_DOCUMENT_EXPIRING: { tier: 'TRANSACTIONAL', category: 'none', priority: 'HIGH' },

  // Phase 16 — Support Tickets & Grievance Resolution. TRANSACTIONAL: a reply or status change on
  // a ticket the patient themselves opened is exactly the kind of "I'm waiting on this" event that
  // must never be silently suppressed by a preference toggle — same reasoning as
  // CLINIC_VERIFICATION_UPDATED.
  SUPPORT_TICKET_UPDATE: { tier: 'TRANSACTIONAL', category: 'none', priority: 'NORMAL' },

  SECURITY_LOGIN: { tier: 'SECURITY', category: 'none', priority: 'HIGH' },
  SECURITY_PASSWORD_CHANGED: { tier: 'SECURITY', category: 'none', priority: 'CRITICAL' },
};
