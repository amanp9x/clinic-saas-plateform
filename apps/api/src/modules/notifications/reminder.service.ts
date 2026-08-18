import type { AppointmentStatus } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { logger } from '../../config/logger.js';
import { notifyUser } from './notification-dispatch.service.js';
import { appointmentReminderEmail, followUpDueEmail } from './email/templates.js';
import { env } from '../../config/env.js';

const ACTIVE_STATUSES: AppointmentStatus[] = ['CONFIRMED', 'CHECKED_IN'];

interface ReminderTier {
  key: string;
  offsetMinutes: number;
  type: 'APPOINTMENT_REMINDER' | 'APPOINTMENT_STARTING_SOON';
  timingLabel: string;
}

/** Two fixed tiers: a day-before reminder, and a clinic-configurable "starting soon" reminder
 * reusing the existing (previously unused) `ClinicSettings.reminderMinutesBefore` field from
 * Phase 6 — no new schema field invented for "configurable timing". */
const DAY_BEFORE_TIER: ReminderTier = { key: '24h', offsetMinutes: 24 * 60, type: 'APPOINTMENT_REMINDER', timingLabel: 'tomorrow' };

function appointmentUrl(appointmentId: string): string {
  return `${env.WEB_URL}/appointments/${appointmentId}`;
}

async function fireReminder(appointment: {
  id: string;
  bookingReference: string;
  scheduledAt: Date;
  clinic: { name: string };
  doctor: { displayName: string };
  patient: { fullName: string; userId: string; user: { email: string | null } };
}, tier: ReminderTier): Promise<void> {
  const notificationKey = `reminder:${appointment.id}:${tier.key}`;
  const existing = await prisma.notification.findUnique({ where: { notificationKey }, select: { id: true } });
  if (existing) return; // already sent — cheap pre-check before building the full payload

  const email = appointment.patient.user.email
    ? appointmentReminderEmail({
        clinicName: appointment.clinic.name,
        doctorName: appointment.doctor.displayName,
        patientName: appointment.patient.fullName,
        bookingReference: appointment.bookingReference,
        scheduledAt: appointment.scheduledAt,
        actionUrl: appointmentUrl(appointment.id),
        timingLabel: tier.timingLabel,
      })
    : undefined;

  await notifyUser({
    userId: appointment.patient.userId,
    type: tier.type,
    title: tier.type === 'APPOINTMENT_REMINDER' ? 'Appointment reminder' : 'Appointment starting soon',
    message: `Your appointment with ${appointment.doctor.displayName} is ${tier.timingLabel} at ${appointment.scheduledAt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}. Reference: ${appointment.bookingReference}.`,
    relatedEntityType: 'Appointment',
    relatedEntityId: appointment.id,
    actionUrl: `/appointments/${appointment.id}`,
    notificationKey,
    email,
  });
}

/**
 * Finds appointments that have just crossed a reminder threshold and dispatches exactly one
 * reminder each (idempotent via `notificationKey`, so re-running this on every tick — including
 * concurrently with itself — never double-sends). No background job framework exists in this
 * codebase; see `startReminderScheduler` for the bounded, self-contained timer that calls this.
 */
export async function processDueReminders(now: Date = new Date()): Promise<{ processed: number }> {
  let processed = 0;

  const dayBeforeWindowEnd = new Date(now.getTime() + DAY_BEFORE_TIER.offsetMinutes * 60_000);
  const dayBeforeCandidates = await prisma.appointment.findMany({
    where: { status: { in: ACTIVE_STATUSES }, scheduledAt: { gt: now, lte: dayBeforeWindowEnd } },
    select: {
      id: true,
      bookingReference: true,
      scheduledAt: true,
      clinicId: true,
      clinic: { select: { name: true } },
      doctor: { select: { displayName: true } },
      patient: { select: { fullName: true, userId: true, user: { select: { email: true } } } },
    },
  });
  for (const appt of dayBeforeCandidates) {
    await fireReminder(appt, DAY_BEFORE_TIER);
    processed++;
  }

  // "Starting soon" tier — each clinic's own configurable reminderMinutesBefore is read via the
  // nested `clinic.settings` include below, so no separate per-appointment settings lookup.
  const upcomingSoonCandidates = await prisma.appointment.findMany({
    where: { status: { in: ACTIVE_STATUSES }, scheduledAt: { gt: now, lte: new Date(now.getTime() + 4 * 60 * 60_000) } },
    select: {
      id: true,
      bookingReference: true,
      scheduledAt: true,
      clinicId: true,
      clinic: { select: { name: true, settings: { select: { reminderMinutesBefore: true } } } },
      doctor: { select: { displayName: true } },
      patient: { select: { fullName: true, userId: true, user: { select: { email: true } } } },
    },
  });
  for (const appt of upcomingSoonCandidates) {
    const offsetMinutes = appt.clinic.settings?.reminderMinutesBefore ?? 60;
    const dueAt = new Date(appt.scheduledAt.getTime() - offsetMinutes * 60_000);
    if (now < dueAt) continue;
    await fireReminder(appt, { key: `soon-${offsetMinutes}m`, offsetMinutes, type: 'APPOINTMENT_STARTING_SOON', timingLabel: 'starting soon' });
    processed++;
  }

  return { processed };
}

function bookFollowUpUrl(doctorId: string, clinicId: string): string {
  return `${env.WEB_URL}/book?doctorId=${doctorId}&clinicId=${clinicId}`;
}

/**
 * Phase 14 — the follow-up counterpart to `processDueReminders` above, same idempotent-via-
 * notificationKey idiom. Bounded to a 24h-past window (`followUpDate` in `(now - 24h, now]`) so
 * shipping this feature never floods every patient with a historical `Consultation.followUpDate`
 * that predates this code — only follow-ups that become due *after* deploy ever fire, and a brief
 * scheduler outage of less than a day still catches up correctly rather than silently skipping.
 * Source of truth is `Consultation.followUpDate` only (not `Prescription.followUpDate`, which is
 * typically the same value copied at prescription time) — one reminder per visit, not two.
 */
export async function processDueFollowUpReminders(now: Date = new Date()): Promise<{ processed: number }> {
  let processed = 0;
  const windowStart = new Date(now.getTime() - 24 * 60 * 60_000);

  const candidates = await prisma.consultation.findMany({
    where: { followUpDate: { gt: windowStart, lte: now } },
    select: {
      id: true,
      doctorId: true,
      clinicId: true,
      followUpDate: true,
      clinic: { select: { name: true } },
      doctor: { select: { displayName: true } },
      patient: { select: { fullName: true, userId: true, user: { select: { email: true } } } },
    },
  });

  for (const consultation of candidates) {
    const notificationKey = `followup:${consultation.id}:reminder`;
    const existing = await prisma.notification.findUnique({ where: { notificationKey }, select: { id: true } });
    if (existing) continue;

    const actionUrl = bookFollowUpUrl(consultation.doctorId, consultation.clinicId);
    const email = consultation.patient.user.email
      ? followUpDueEmail({
          clinicName: consultation.clinic.name,
          patientName: consultation.patient.fullName,
          doctorName: consultation.doctor.displayName,
          followUpDate: consultation.followUpDate!,
          actionUrl,
        })
      : undefined;

    await notifyUser({
      userId: consultation.patient.userId,
      type: 'FOLLOW_UP_DUE',
      title: 'Follow-up recommended',
      message: `${consultation.doctor.displayName} recommended a follow-up visit. Book whenever suits you.`,
      relatedEntityType: 'Consultation',
      relatedEntityId: consultation.id,
      actionUrl,
      notificationKey,
      email,
    });
    processed++;
  }

  return { processed };
}

let reminderInterval: NodeJS.Timeout | null = null;

/** Started once at process boot (server.ts only — never in app.ts/tests, so the test suite never
 * has a background timer running). A single `setInterval`, not an unbounded recursive process:
 * errors are caught per-tick so one bad run never kills the timer or crashes the process, and
 * `stopReminderScheduler` gives a clean shutdown hook. */
export function startReminderScheduler(intervalMs = 60_000): void {
  if (reminderInterval) return;
  reminderInterval = setInterval(() => {
    processDueReminders().catch((err) => logger.error({ err }, 'processDueReminders failed'));
    processDueFollowUpReminders().catch((err) => logger.error({ err }, 'processDueFollowUpReminders failed'));
  }, intervalMs);
  reminderInterval.unref?.();
}

export function stopReminderScheduler(): void {
  if (reminderInterval) clearInterval(reminderInterval);
  reminderInterval = null;
}
