import { NotificationType } from '@prisma/client';
import { SOCKET_EVENTS } from '@clinic/shared';
import { logger } from '../../config/logger.js';
import { emitToClinicRoom, emitToUserRoom } from '../../sockets/emit.js';
import { notifyUser } from '../notifications/notification-dispatch.service.js';
import { waitlistRepository } from './waitlist.repository.js';

/**
 * Called from the booking engine (cancel/no-show/reschedule-away) whenever a specific
 * doctor+clinic+date slot frees up. Never auto-books — every ACTIVE/NOTIFIED entry for that day
 * is simply told a slot opened, and whoever books first via the normal booking engine wins (its
 * existing partial unique index on `appointments` is what actually prevents a double-claim, so
 * no new claim mechanism is needed here). Wrapped defensively: a failure here must never abort
 * the cancellation/no-show/reschedule that triggered it — that write has already committed.
 */
export async function notifyWaitlistForFreedSlot(params: { doctorId: string; clinicId: string; targetDate: Date }): Promise<void> {
  try {
    const matches = await waitlistRepository.findMatchingForFreedSlot(params.doctorId, params.clinicId, params.targetDate);
    if (matches.length === 0) return;

    // All matches share the same doctorId+clinicId by construction — any one entry's relations
    // give the display names, no separate lookup needed.
    const doctorName = matches[0]!.doctor.displayName;
    const clinicName = matches[0]!.clinic.name;
    const dateLabel = params.targetDate.toLocaleDateString('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
    for (const entry of matches) {
      await notifyUser({
        userId: entry.patient.userId,
        type: NotificationType.WAITLIST_SLOT_AVAILABLE,
        title: 'A slot opened up',
        message: `A slot with ${doctorName} on ${dateLabel} is now available at ${clinicName}. Book it before it's gone.`,
        relatedEntityType: 'WaitlistEntry',
        relatedEntityId: entry.id,
        actionUrl: `/book?doctorId=${params.doctorId}&clinicId=${params.clinicId}`,
        // Deterministic, entry-scoped (not appointment-scoped) — a second freed slot on the same
        // day for an entry already notified is deliberately deduped by this same key. Accepted
        // trade-off, same reasoning as REVIEW_HIDDEN's notification key (Phase 12).
        notificationKey: `waitlist:${entry.id}:slot-available`,
      });
      emitToUserRoom(entry.patient.userId, SOCKET_EVENTS.WAITLIST.SLOT_AVAILABLE, {
        waitlistEntryId: entry.id,
        doctorId: params.doctorId,
        clinicId: params.clinicId,
      });
    }
    await waitlistRepository.markNotified(matches.map((m) => m.id));
    emitToClinicRoom(params.clinicId, SOCKET_EVENTS.WAITLIST.SLOT_AVAILABLE, { doctorId: params.doctorId, clinicId: params.clinicId });
  } catch (err) {
    logger.error({ err, doctorId: params.doctorId, clinicId: params.clinicId }, 'Failed to notify waitlist for freed slot');
  }
}

/**
 * Called after a successful booking or reschedule to check whether it just satisfies a standing
 * waitlist entry for the same patient+doctor+clinic+date, closing the loop so "My Waitlist" stops
 * showing an already-solved request. Wrapped defensively for the same reason as above — this is a
 * closing-the-loop side effect, never the source of truth for whether the booking itself succeeded.
 */
export async function fulfillWaitlistIfMatched(params: {
  patientId: string;
  doctorId: string;
  clinicId: string;
  targetDate: Date;
  appointmentId: string;
}): Promise<void> {
  try {
    const entry = await waitlistRepository.findMatchingForFulfillment(params.patientId, params.doctorId, params.clinicId, params.targetDate);
    if (!entry) return;
    await waitlistRepository.markFulfilled(entry.id, params.appointmentId);
    emitToClinicRoom(params.clinicId, SOCKET_EVENTS.WAITLIST.FULFILLED, { waitlistEntryId: entry.id, clinicId: params.clinicId });
  } catch (err) {
    logger.error({ err, patientId: params.patientId, doctorId: params.doctorId, clinicId: params.clinicId }, 'Failed to check/fulfill waitlist entry');
  }
}
