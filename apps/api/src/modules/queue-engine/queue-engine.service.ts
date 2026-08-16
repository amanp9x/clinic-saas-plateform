import { AppointmentStatus, UserRole, type Gender, type PaymentStatus, type TokenPriority } from '@prisma/client';
import { SOCKET_EVENTS } from '@clinic/shared';
import { isUniqueConstraintError, queueRepository, type TokenWithPatient } from '../doctor-queue/queue.repository.js';
import { toTokenDto } from '../doctor-queue/queue.mappers.js';
import { prisma } from '../../config/database.js';
import { ConflictError, NotFoundError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';
import { emitToClinicRoom } from '../../sockets/emit.js';
import { generateBookingReference } from '../booking/booking-reference.util.js';
import { notifyUser } from '../notifications/notification-dispatch.service.js';

const BOOKABLE_STATUSES = new Set<AppointmentStatus>([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]);

/** Two receptionists checking in the first patient of the day can both see "no session yet"
 * and race to create one — the unique `[doctorId, clinicId, sessionDate]` constraint lets only
 * one `create` win; the loser re-reads and uses that row instead of failing the request. */
async function findOrCreateSession(doctorId: string, clinicId: string) {
  const existing = await queueRepository.findSession(doctorId, clinicId);
  if (existing) return existing;
  try {
    return await queueRepository.createSession(doctorId, clinicId);
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      const raceWinner = await queueRepository.findSession(doctorId, clinicId);
      if (raceWinner) return raceWinner;
    }
    throw err;
  }
}

/**
 * Net-new reception operations that don't fit inside the doctor-self-scoped
 * `doctor-queue`/`doctor-appointments` modules (check-in, walk-in registration). Both create
 * `QueueToken`s via the concurrency-safe `createTokenWithRetry` so two receptionists
 * checking in / registering at the same instant never collide on a token number.
 */
export const queueEngine = {
  /** Checks in a patient for an existing appointment and creates their queue token. Rejects a
   * second check-in for the same appointment (the QueueToken.appointmentId unique constraint
   * is the hard backstop; this is the friendly pre-check). */
  async checkIn(actorUserId: string, appointmentId: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { patient: true, doctor: true, clinic: true },
    });
    if (!appointment) {
      throw new NotFoundError('Appointment');
    }
    if (!BOOKABLE_STATUSES.has(appointment.status)) {
      throw new ConflictError(`An appointment with status ${appointment.status} cannot be checked in`);
    }
    const existingToken = await queueRepository.findTokenByAppointmentId(appointmentId);
    if (existingToken) {
      throw new ConflictError('This patient is already checked in');
    }

    const session = await findOrCreateSession(appointment.doctorId, appointment.clinicId);
    const token = await queueRepository.createTokenWithRetry(session.id, (_tokenNumber) => ({
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      type: 'SCHEDULED',
      priority: 'NORMAL',
    }));
    await prisma.appointment.update({ where: { id: appointmentId }, data: { status: AppointmentStatus.CHECKED_IN } });

    recordAuditLog({
      actorUserId,
      action: 'reception.patient_checked_in',
      entityType: 'Appointment',
      entityId: appointmentId,
      clinicId: appointment.clinicId,
      metadata: { doctorId: appointment.doctorId, patientId: appointment.patientId, tokenId: token.id, tokenNumber: token.tokenNumber },
    });
    await notifyUser({
      userId: appointment.patient.userId,
      type: 'APPOINTMENT_CHECKED_IN',
      title: "You're checked in",
      message: `You've been checked in. Token #${token.tokenNumber}.`,
      relatedEntityType: 'Appointment',
      relatedEntityId: appointmentId,
      actionUrl: `/queue/${appointmentId}`,
      notificationKey: `appointment:${appointmentId}:checked_in`,
    });
    emitToClinicRoom(appointment.clinicId, SOCKET_EVENTS.PATIENT.CHECKED_IN, { clinicId: appointment.clinicId, appointmentId, token: toTokenDto(token) });
    emitToClinicRoom(appointment.clinicId, SOCKET_EVENTS.TOKEN.CREATED, { clinicId: appointment.clinicId, token: toTokenDto(token) });
    emitToClinicRoom(appointment.clinicId, SOCKET_EVENTS.QUEUE.UPDATED, { clinicId: appointment.clinicId });
    return { appointment, token };
  },

  /** Registers a walk-in patient: links an existing patient by id/phone when possible (never
   * creates a duplicate account), otherwise provisions a passwordless PATIENT user — the same
   * pattern used for Patient Portal OTP sign-up — then creates an immediately-checked-in
   * appointment + queue token. */
  async registerWalkIn(
    actorUserId: string,
    input: {
      clinicId: string;
      doctorId: string;
      existingPatientId?: string;
      fullName?: string;
      phone?: string;
      age?: number;
      gender?: Gender;
      reasonForVisit?: string;
      paymentStatus: PaymentStatus;
      priority: TokenPriority;
    },
  ) {
    const patient = await queueEngine.resolveWalkInPatient(input);

    const scheduledAt = new Date();
    const appointment = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: input.doctorId,
        clinicId: input.clinicId,
        scheduledAt,
        status: AppointmentStatus.CHECKED_IN,
        reasonForVisit: input.reasonForVisit || null,
        paymentStatus: input.paymentStatus,
        bookingReference: generateBookingReference(scheduledAt),
        bookingSource: 'RECEPTION',
      },
      include: { patient: true, doctor: true, clinic: true },
    });

    const session = await findOrCreateSession(input.doctorId, input.clinicId);
    const token = await queueRepository.createTokenWithRetry(session.id, (_tokenNumber) => ({
      appointmentId: appointment.id,
      patientId: patient.id,
      type: 'WALK_IN',
      priority: input.priority,
    }));

    recordAuditLog({
      actorUserId,
      action: 'reception.walkin_registered',
      entityType: 'Appointment',
      entityId: appointment.id,
      clinicId: input.clinicId,
      metadata: { doctorId: input.doctorId, patientId: patient.id, tokenId: token.id, tokenNumber: token.tokenNumber, priority: input.priority },
    });
    emitToClinicRoom(input.clinicId, SOCKET_EVENTS.PATIENT.CHECKED_IN, { clinicId: input.clinicId, appointmentId: appointment.id, token: toTokenDto(token) });
    emitToClinicRoom(input.clinicId, SOCKET_EVENTS.TOKEN.CREATED, { clinicId: input.clinicId, token: toTokenDto(token) });
    emitToClinicRoom(input.clinicId, SOCKET_EVENTS.QUEUE.UPDATED, { clinicId: input.clinicId });
    return { appointment, token };
  },

  async resolveWalkInPatient(input: { existingPatientId?: string; fullName?: string; phone?: string; age?: number; gender?: Gender }) {
    if (input.existingPatientId) {
      const patient = await prisma.patient.findUnique({ where: { id: input.existingPatientId } });
      if (!patient) throw new NotFoundError('Patient');
      return patient;
    }

    if (input.phone) {
      const existingUser = await prisma.user.findUnique({ where: { phone: input.phone }, include: { patientProfile: true } });
      if (existingUser?.patientProfile) {
        return existingUser.patientProfile;
      }
    }

    const dateOfBirth = input.age != null ? new Date(new Date().setFullYear(new Date().getFullYear() - input.age)) : undefined;
    const user = await prisma.user.create({
      data: {
        phone: input.phone,
        role: UserRole.PATIENT,
        isMobileVerified: false,
        patientProfile: {
          create: {
            fullName: input.fullName || 'Walk-in Patient',
            dateOfBirth,
            gender: input.gender,
          },
        },
      },
      include: { patientProfile: true },
    });
    return user.patientProfile!;
  },

  /** Number of WAITING tokens whose queue rank puts them before `token` — used to derive the
   * per-token `patientsAhead`/`etaMinutes` shown on the reception console. */
  async patientsAheadFor(sessionId: string, token: TokenWithPatient): Promise<number | null> {
    if (token.status !== 'WAITING') return token.status === 'CALLED' ? 0 : null;
    return queueRepository.countWaitingAhead(sessionId, token);
  },
};
