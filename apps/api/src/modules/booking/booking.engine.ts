import type { AppointmentType, BookingSource, ConsultationType, Prisma } from '@prisma/client';
import { AppointmentStatus, NotificationType } from '@prisma/client';
import { SOCKET_EVENTS } from '@clinic/shared';
import { prisma } from '../../config/database.js';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';
import { emitToClinicRoom, emitToUserRoom } from '../../sockets/emit.js';
import { notifyUser } from '../notifications/notifications.service.js';
import { isUniqueConstraintError } from '../doctor-queue/queue.repository.js';
import { requireDoctorAtClinic } from '../reception/reception.shared.js';
import { timeMinutes } from '../../utils/time.util.js';
import { generateAvailableSlots } from './booking.availability.js';
import { bookingRepository, HOLD_MINUTES_DEFAULT, HOLD_MINUTES_INTERNAL } from './booking.repository.js';
import { generateBookingReference } from './booking-reference.util.js';

const RESCHEDULABLE_STATUSES = new Set<AppointmentStatus>([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]);
export const CANCELLABLE_STATUSES = new Set<AppointmentStatus>([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]);

const appointmentDetailInclude = {
  doctor: { include: { specialization: true } },
  clinic: true,
  patient: { include: { user: true } },
  prescriptions: { select: { id: true } },
} satisfies Prisma.AppointmentInclude;

export type BookingAppointment = Prisma.AppointmentGetPayload<{ include: typeof appointmentDetailInclude }>;

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function resolveFeeForDoctorClinic(doctorId: string, clinicId: string): Promise<number | null> {
  const clinicDoctor = await requireDoctorAtClinic(doctorId, clinicId);
  const value = clinicDoctor.consultationFeeOverride ?? clinicDoctor.doctor.consultationFee;
  return value ? Number(value) : null;
}

/**
 * Re-validates business-rule eligibility (doctor still accepting, no new leave/holiday/block) at
 * confirm time — a hold proves exclusive claim on a slot, not immunity from rule changes made
 * while it was held (e.g. a DoctorLeave added after the hold was created). This is what makes
 * race condition (D) from the test plan resolve safely.
 */
async function assertSlotStillEligible(doctorId: string, clinicId: string, scheduledAt: Date, durationMinutes: number): Promise<void> {
  const clinicDoctor = await requireDoctorAtClinic(doctorId, clinicId);
  if (!clinicDoctor.isActive || clinicDoctor.status !== 'ACTIVE' || !clinicDoctor.isAcceptingAppointments) {
    throw new ConflictError('This doctor is no longer accepting appointments at this clinic');
  }

  const dateOnly = new Date(Date.UTC(scheduledAt.getFullYear(), scheduledAt.getMonth(), scheduledAt.getDate()));
  const leaves = await bookingRepository.findDoctorLeaves(doctorId, clinicId, dateOnly);
  if (leaves.length > 0) {
    throw new ConflictError('The doctor has gone on leave for this date');
  }

  const holiday = await bookingRepository.findClinicHoliday(clinicId, dateOnly);
  if (holiday) {
    if (holiday.isFullDay) {
      throw new ConflictError('The clinic is now closed for a holiday on this date');
    }
    if (holiday.startTime && holiday.endTime) {
      const slotStartMin = scheduledAt.getHours() * 60 + scheduledAt.getMinutes();
      const slotEndMin = slotStartMin + durationMinutes;
      const holidayStart = timeMinutes(holiday.startTime);
      const holidayEnd = timeMinutes(holiday.endTime);
      if (slotStartMin < holidayEnd && holidayStart < slotEndMin) {
        throw new ConflictError('This time now falls within a clinic holiday window');
      }
    }
  }

  const slotEnd = new Date(scheduledAt.getTime() + durationMinutes * 60_000);
  const blocks = await bookingRepository.findActiveBlocksForRange(doctorId, clinicId, scheduledAt, slotEnd);
  const overlapping = blocks.some((b) => scheduledAt.getTime() < b.endAt.getTime() && b.startAt.getTime() < slotEnd.getTime());
  if (overlapping) {
    throw new ConflictError('This slot has just been blocked');
  }
}

async function resolveAvailableCandidate(doctorId: string, clinicId: string, scheduledAt: Date, consultationType: ConsultationType) {
  const availability = await generateAvailableSlots({
    doctorId,
    clinicId,
    date: toLocalDateString(scheduledAt),
    consultationType,
  });
  const slot = availability.slots.find((s) => s.startAt.getTime() === scheduledAt.getTime());
  if (!slot || slot.status !== 'AVAILABLE') {
    throw new ConflictError('This slot is not available');
  }
  return slot;
}

export interface HoldSlotParams {
  actorUserId: string;
  patientId: string;
  bookingSource: BookingSource;
  doctorId: string;
  clinicId: string;
  scheduledAt: Date;
  consultationType: ConsultationType;
}

export const bookingEngine = {
  async holdSlot(params: HoldSlotParams) {
    const slot = await resolveAvailableCandidate(params.doctorId, params.clinicId, params.scheduledAt, params.consultationType);

    const hold = await bookingRepository.claimSlot({
      doctorId: params.doctorId,
      clinicId: params.clinicId,
      scheduledAt: params.scheduledAt,
      durationMinutes: slot.durationMinutes,
      patientId: params.patientId,
      heldByUserId: params.actorUserId,
      bookingSource: params.bookingSource,
      consultationType: params.consultationType,
      holdMinutes: HOLD_MINUTES_DEFAULT,
    });

    recordAuditLog({
      actorUserId: params.actorUserId,
      action: 'slot.held',
      entityType: 'SlotHold',
      entityId: hold.id,
      clinicId: params.clinicId,
      metadata: { doctorId: params.doctorId, scheduledAt: params.scheduledAt.toISOString() },
    });
    emitToClinicRoom(params.clinicId, SOCKET_EVENTS.SLOT.HELD, {
      doctorId: params.doctorId,
      clinicId: params.clinicId,
      scheduledAt: params.scheduledAt.toISOString(),
    });

    return hold;
  },

  async releaseHold(holdId: string, actorUserId: string) {
    const hold = await bookingRepository.findActiveHoldById(holdId);
    if (!hold) return;
    // Idempotent by design — releasing an already-released/expired/foreign hold is a no-op, not
    // an error (the caller shouldn't have to know whether their hold already lapsed).
    if (hold.status !== 'ACTIVE' || hold.heldByUserId !== actorUserId) return;
    await bookingRepository.releaseHoldIfActive(holdId, actorUserId);
    recordAuditLog({
      actorUserId,
      action: 'slot.released',
      entityType: 'SlotHold',
      entityId: holdId,
      clinicId: hold.clinicId,
      metadata: { doctorId: hold.doctorId, scheduledAt: hold.scheduledAt.toISOString() },
    });
    emitToClinicRoom(hold.clinicId, SOCKET_EVENTS.SLOT.RELEASED, {
      doctorId: hold.doctorId,
      clinicId: hold.clinicId,
      scheduledAt: hold.scheduledAt.toISOString(),
    });
  },

  async book(params: {
    actorUserId: string;
    patientId: string;
    bookingSource: BookingSource;
    holdId?: string;
    doctorId?: string;
    clinicId?: string;
    scheduledAt?: Date;
    consultationType?: ConsultationType;
    appointmentType: AppointmentType;
    reasonForVisit?: string;
  }): Promise<BookingAppointment> {
    let doctorId: string;
    let clinicId: string;
    let scheduledAt: Date;
    let consultationType: ConsultationType;
    let durationMinutes: number;
    let feeRupees: number | null;
    let holdId: string | null;

    if (params.holdId) {
      const hold = await bookingRepository.findActiveHoldById(params.holdId);
      if (!hold || hold.status !== 'ACTIVE' || hold.expiresAt.getTime() < Date.now() || hold.heldByUserId !== params.actorUserId) {
        throw new ConflictError('This hold has expired or is no longer valid — please pick a slot again');
      }
      await assertSlotStillEligible(hold.doctorId, hold.clinicId, hold.scheduledAt, hold.durationMinutes);
      doctorId = hold.doctorId;
      clinicId = hold.clinicId;
      scheduledAt = hold.scheduledAt;
      consultationType = hold.consultationType;
      durationMinutes = hold.durationMinutes;
      feeRupees = await resolveFeeForDoctorClinic(doctorId, clinicId);
      holdId = hold.id;
    } else {
      if (!params.doctorId || !params.clinicId || !params.scheduledAt || !params.consultationType) {
        throw new ValidationError('doctorId, clinicId, scheduledAt and consultationType are required when no holdId is supplied');
      }
      doctorId = params.doctorId;
      clinicId = params.clinicId;
      scheduledAt = params.scheduledAt;
      consultationType = params.consultationType;
      const slot = await resolveAvailableCandidate(doctorId, clinicId, scheduledAt, consultationType);
      durationMinutes = slot.durationMinutes;
      feeRupees = slot.feeRupees;
      // Direct-book fast path (reception "Add appointment", or a patient skipping the explicit
      // hold step) — internally claims exclusivity via the exact same primitive as an explicit
      // hold, then immediately proceeds to confirm in the same request. Same booking engine,
      // no parallel slot logic per portal.
      const claimed = await bookingRepository.claimSlot({
        doctorId,
        clinicId,
        scheduledAt,
        durationMinutes,
        patientId: params.patientId,
        heldByUserId: params.actorUserId,
        bookingSource: params.bookingSource,
        consultationType,
        holdMinutes: HOLD_MINUTES_INTERNAL,
      });
      holdId = claimed.id;
    }

    const bookingReference = generateBookingReference(scheduledAt);
    let appointment: BookingAppointment;
    try {
      appointment = await prisma.appointment.create({
        data: {
          patientId: params.patientId,
          doctorId,
          clinicId,
          scheduledAt,
          status: AppointmentStatus.CONFIRMED,
          consultationType,
          appointmentType: params.appointmentType,
          reasonForVisit: params.reasonForVisit ?? null,
          durationMinutes,
          consultationFee: feeRupees,
          bookingReference,
          bookingSource: params.bookingSource,
        },
        include: appointmentDetailInclude,
      });
    } catch (err) {
      // Extremely narrow window (the internal claim above should already make this
      // unreachable in practice) — kept as defense-in-depth, not the primary guarantee.
      if (isUniqueConstraintError(err)) {
        throw new ConflictError('This slot was just booked by someone else');
      }
      throw err;
    }

    if (holdId) {
      await bookingRepository.releaseHold(holdId);
    }

    recordAuditLog({
      actorUserId: params.actorUserId,
      action: 'appointment.created',
      entityType: 'Appointment',
      entityId: appointment.id,
      clinicId,
      metadata: { doctorId, patientId: params.patientId, scheduledAt: scheduledAt.toISOString(), bookingSource: params.bookingSource },
    });
    await notifyUser({
      userId: appointment.patient.user.id,
      type: NotificationType.APPOINTMENT_UPDATE,
      title: 'Appointment confirmed',
      message: `Your appointment with ${appointment.doctor.displayName} on ${scheduledAt.toLocaleString('en-IN')} is confirmed. Reference: ${bookingReference}.`,
      relatedEntityType: 'Appointment',
      relatedEntityId: appointment.id,
    });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.APPOINTMENT.CREATED, { appointmentId: appointment.id, clinicId, doctorId, scheduledAt: scheduledAt.toISOString() });
    emitToUserRoom(appointment.patient.user.id, SOCKET_EVENTS.APPOINTMENT.CREATED, { appointmentId: appointment.id });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.SLOT.RELEASED, { doctorId, clinicId, scheduledAt: scheduledAt.toISOString() });

    return appointment;
  },

  async reschedule(
    appointmentId: string,
    actorUserId: string,
    bookingSource: BookingSource,
    input: { newScheduledAt: Date; holdId?: string; reason?: string },
  ): Promise<BookingAppointment> {
    const appointment = await bookingRepository.findAppointmentByIdForActor(appointmentId);
    if (!appointment) {
      throw new NotFoundError('Appointment');
    }
    if (!RESCHEDULABLE_STATUSES.has(appointment.status)) {
      throw new ConflictError(`An appointment with status ${appointment.status} cannot be rescheduled`);
    }

    let newScheduledAt = input.newScheduledAt;
    let durationMinutes: number;
    let feeRupees: number | null;
    let holdIdToRelease: string | null;

    if (input.holdId) {
      const hold = await bookingRepository.findActiveHoldById(input.holdId);
      if (
        !hold ||
        hold.status !== 'ACTIVE' ||
        hold.expiresAt.getTime() < Date.now() ||
        hold.heldByUserId !== actorUserId ||
        hold.doctorId !== appointment.doctorId ||
        hold.clinicId !== appointment.clinicId
      ) {
        throw new ConflictError('This hold has expired or is no longer valid — please pick a slot again');
      }
      await assertSlotStillEligible(appointment.doctorId, appointment.clinicId, hold.scheduledAt, hold.durationMinutes);
      newScheduledAt = hold.scheduledAt;
      durationMinutes = hold.durationMinutes;
      feeRupees = await resolveFeeForDoctorClinic(appointment.doctorId, appointment.clinicId);
      holdIdToRelease = hold.id;
    } else {
      const slot = await resolveAvailableCandidate(appointment.doctorId, appointment.clinicId, newScheduledAt, appointment.consultationType);
      durationMinutes = slot.durationMinutes;
      feeRupees = slot.feeRupees;
      const claimed = await bookingRepository.claimSlot({
        doctorId: appointment.doctorId,
        clinicId: appointment.clinicId,
        scheduledAt: newScheduledAt,
        durationMinutes,
        patientId: appointment.patientId,
        heldByUserId: actorUserId,
        bookingSource,
        consultationType: appointment.consultationType,
        holdMinutes: HOLD_MINUTES_INTERNAL,
      });
      holdIdToRelease = claimed.id;
    }

    const previousScheduledAt = appointment.scheduledAt;
    let updated: BookingAppointment;
    try {
      updated = await prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          previousScheduledAt,
          scheduledAt: newScheduledAt,
          rescheduledAt: new Date(),
          rescheduledByUserId: actorUserId,
          rescheduleReason: input.reason ?? null,
          rescheduleCount: { increment: 1 },
          durationMinutes,
          consultationFee: feeRupees,
        },
        include: appointmentDetailInclude,
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new ConflictError('This slot was just booked by someone else');
      }
      throw err;
    }

    if (holdIdToRelease) {
      await bookingRepository.releaseHold(holdIdToRelease);
    }

    recordAuditLog({
      actorUserId,
      action: 'appointment.rescheduled',
      entityType: 'Appointment',
      entityId: appointmentId,
      clinicId: appointment.clinicId,
      metadata: { previousScheduledAt: previousScheduledAt.toISOString(), newScheduledAt: newScheduledAt.toISOString(), reason: input.reason ?? null },
    });
    await notifyUser({
      userId: appointment.patient.user.id,
      type: NotificationType.APPOINTMENT_UPDATE,
      title: 'Appointment rescheduled',
      message: `Your appointment with ${appointment.doctor.displayName} has been moved to ${newScheduledAt.toLocaleString('en-IN')}.`,
      relatedEntityType: 'Appointment',
      relatedEntityId: appointmentId,
    });
    emitToClinicRoom(appointment.clinicId, SOCKET_EVENTS.APPOINTMENT.RESCHEDULED, {
      appointmentId,
      clinicId: appointment.clinicId,
      previousScheduledAt: previousScheduledAt.toISOString(),
      scheduledAt: newScheduledAt.toISOString(),
    });
    emitToUserRoom(appointment.patient.user.id, SOCKET_EVENTS.APPOINTMENT.RESCHEDULED, { appointmentId });

    return updated;
  },

  /** Shared cancellation core used by both the patient self-cancel path and reception's
   * cancel-on-behalf-of-patient path — records who/reason/timestamp/source/previous-status,
   * consistent regardless of which portal initiated it. */
  async cancelCore(
    appointment: BookingAppointment,
    input: { reason: string; actorUserId: string; source: BookingSource },
  ): Promise<BookingAppointment> {
    if (!CANCELLABLE_STATUSES.has(appointment.status)) {
      throw new ConflictError(`An appointment with status ${appointment.status} cannot be cancelled`);
    }

    const previousStatus = appointment.status;
    const cancelled = await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        status: AppointmentStatus.CANCELLED,
        cancelReason: input.reason,
        cancelledAt: new Date(),
        cancelledByUserId: input.actorUserId,
        cancelSource: input.source,
        previousStatusBeforeCancel: previousStatus,
      },
      include: appointmentDetailInclude,
    });

    recordAuditLog({
      actorUserId: input.actorUserId,
      action: 'appointment.cancelled',
      entityType: 'Appointment',
      entityId: appointment.id,
      clinicId: appointment.clinicId,
      metadata: { reason: input.reason, previousStatus, source: input.source },
    });
    await notifyUser({
      userId: appointment.patient.user.id,
      type: NotificationType.APPOINTMENT_UPDATE,
      title: 'Appointment cancelled',
      message: `Your appointment with ${appointment.doctor.displayName} on ${appointment.scheduledAt.toLocaleDateString('en-IN')} has been cancelled.`,
      relatedEntityType: 'Appointment',
      relatedEntityId: appointment.id,
    });
    emitToClinicRoom(appointment.clinicId, SOCKET_EVENTS.APPOINTMENT.CANCELLED, { appointmentId: appointment.id, clinicId: appointment.clinicId, status: 'CANCELLED' });
    emitToUserRoom(appointment.patient.user.id, SOCKET_EVENTS.APPOINTMENT.CANCELLED, { appointmentId: appointment.id });

    return cancelled;
  },
};
