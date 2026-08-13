import { SOCKET_EVENTS } from '@clinic/shared';
import type { TokenPriority } from '@prisma/client';
import { queueRepository, sortByQueueOrder } from './queue.repository.js';
import { toQueueSnapshot, toTokenDto } from './queue.mappers.js';
import { resolveDoctorOrThrow, assertClinicMembership } from '../doctor/doctor.shared.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';
import { emitToClinicRoom } from '../../sockets/emit.js';

async function buildSnapshot(doctorId: string, clinicId: string, canOverrideDelay: boolean) {
  const session = await queueRepository.findSessionWithTokens(doctorId, clinicId);
  return toQueueSnapshot(session, canOverrideDelay);
}

async function requireOwnedToken(doctorId: string, clinicId: string, tokenId: string) {
  const token = await queueRepository.findToken(tokenId);
  if (!token || token.doctorSession.doctorId !== doctorId || token.doctorSession.clinicId !== clinicId) {
    throw new NotFoundError('Queue token');
  }
  return token;
}

/**
 * Doctor-and-clinic-scoped queue core. Parameterized by an already-resolved `doctorId` (never
 * a userId) so both the doctor-self routes below and the reception queue console can call the
 * exact same mutation logic — the only thing that differs between the two portals is which
 * authorization check runs before the call, not the queue behavior itself.
 */
export const doctorQueueEngine = {
  buildSnapshot,

  async startSession(doctorId: string, clinicId: string, actorUserId: string) {
    let session = await queueRepository.findSession(doctorId, clinicId);
    if (session && session.queueStatus === 'ACTIVE') {
      throw new ConflictError('The queue session is already active');
    }
    session = session
      ? await queueRepository.updateSession(session.id, {
          queueStatus: 'ACTIVE',
          status: session.status === 'NOT_ARRIVED' || session.status === 'SESSION_ENDED' ? 'AVAILABLE' : session.status,
          startedAt: session.startedAt ?? new Date(),
          endedAt: null,
        })
      : await queueRepository.createSession(doctorId, clinicId);

    const unqueued = await queueRepository.listUnqueuedAppointmentsForToday(doctorId, clinicId);
    let nextNumber = await queueRepository.nextTokenNumber(session.id);
    for (const appointment of unqueued) {
      await queueRepository.createToken({
        doctorSessionId: session.id,
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        tokenNumber: nextNumber++,
        type: 'SCHEDULED',
      });
    }

    recordAuditLog({ actorUserId, action: 'queue.session_started', entityType: 'DoctorSession', entityId: session.id, clinicId, metadata: { doctorId } });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.DOCTOR.SESSION_STARTED, { clinicId, sessionId: session.id });
    return session;
  },

  async pauseSession(doctorId: string, clinicId: string, actorUserId: string, reason?: string | null) {
    const session = await queueRepository.findSession(doctorId, clinicId);
    if (!session || session.queueStatus !== 'ACTIVE') {
      throw new ConflictError('The queue is not currently active');
    }
    await queueRepository.updateSession(session.id, { queueStatus: 'PAUSED', pauseReason: reason || null });
    recordAuditLog({ actorUserId, action: 'queue.session_paused', entityType: 'DoctorSession', entityId: session.id, clinicId, metadata: { doctorId, reason } });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.DOCTOR.SESSION_PAUSED, { clinicId });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.QUEUE.PAUSED, { clinicId, doctorId, reason: reason || null });
    return session;
  },

  async resumeSession(doctorId: string, clinicId: string, actorUserId: string) {
    const session = await queueRepository.findSession(doctorId, clinicId);
    if (!session || session.queueStatus !== 'PAUSED') {
      throw new ConflictError('The queue is not currently paused');
    }
    await queueRepository.updateSession(session.id, { queueStatus: 'ACTIVE', pauseReason: null });
    recordAuditLog({ actorUserId, action: 'queue.session_resumed', entityType: 'DoctorSession', entityId: session.id, clinicId, metadata: { doctorId } });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.DOCTOR.SESSION_RESUMED, { clinicId });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.QUEUE.RESUMED, { clinicId, doctorId });
    return session;
  },

  /** Concurrency-safe: atomically claims the next-waiting token via a guarded `updateMany`.
   * If another actor (doctor or a second receptionist) claims it first between our read and
   * write, `count` is 0 and we retry against the newly-recomputed next-waiting token — bounded
   * so a pathological hot loop can't hang the request. */
  async callNext(doctorId: string, clinicId: string, actorUserId: string) {
    const session = await queueRepository.findSession(doctorId, clinicId);
    if (!session || session.queueStatus !== 'ACTIVE') {
      throw new ConflictError('Start the queue session before calling patients');
    }

    const maxAttempts = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const next = await queueRepository.findNextWaiting(session.id);
      if (!next) {
        throw new NotFoundError('No waiting patients');
      }
      const claimed = await queueRepository.claimToken(next.id, 'WAITING', {
        status: 'CALLED',
        calledAt: new Date(),
        calledCount: { increment: 1 },
      });
      if (!claimed) continue;

      const called = await queueRepository.findToken(next.id);
      if (!called) throw new NotFoundError('Queue token');
      await queueRepository.updateSession(session.id, { currentTokenId: called.id });

      recordAuditLog({ actorUserId, action: 'queue.patient_called', entityType: 'QueueToken', entityId: called.id, clinicId, metadata: { doctorId, tokenNumber: called.tokenNumber } });
      emitToClinicRoom(clinicId, SOCKET_EVENTS.PATIENT.CALLED, { clinicId, token: toTokenDto(called), recalled: false });
      emitToClinicRoom(clinicId, SOCKET_EVENTS.TOKEN.CALLED, { clinicId, token: toTokenDto(called) });
      emitToClinicRoom(clinicId, SOCKET_EVENTS.QUEUE.UPDATED, { clinicId });
      emitToClinicRoom(clinicId, SOCKET_EVENTS.DOCTOR.QUEUE_UPDATED, { clinicId });
      return called;
    }
    throw new ConflictError('Could not call the next patient — please try again');
  },

  async repeatCall(doctorId: string, clinicId: string, actorUserId: string, tokenId: string) {
    const token = await requireOwnedToken(doctorId, clinicId, tokenId);
    if (token.status !== 'CALLED') {
      throw new ConflictError('Only a currently-called patient can be re-called');
    }
    const updated = await queueRepository.updateToken(tokenId, { calledAt: new Date(), calledCount: { increment: 1 } });

    recordAuditLog({ actorUserId, action: 'queue.patient_recalled', entityType: 'QueueToken', entityId: tokenId, clinicId, metadata: { doctorId } });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.PATIENT.CALLED, { clinicId, token: toTokenDto(updated), recalled: true });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.TOKEN.REPEATED, { clinicId, token: toTokenDto(updated) });
    return updated;
  },

  async skip(doctorId: string, clinicId: string, actorUserId: string, tokenId: string, reason: string | undefined) {
    const token = await requireOwnedToken(doctorId, clinicId, tokenId);
    if (token.status === 'COMPLETED' || token.status === 'CANCELLED') {
      throw new ConflictError(`A token with status ${token.status} cannot be skipped`);
    }
    const updated = await queueRepository.updateToken(tokenId, {
      status: 'SKIPPED',
      skipReason: reason || null,
    });
    if (token.doctorSession.currentTokenId === tokenId) {
      await queueRepository.updateSession(token.doctorSessionId, { currentTokenId: null });
    }

    recordAuditLog({ actorUserId, action: 'queue.patient_skipped', entityType: 'QueueToken', entityId: tokenId, clinicId, metadata: { doctorId, reason } });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.PATIENT.SKIPPED, { clinicId, token: toTokenDto(updated) });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.TOKEN.SKIPPED, { clinicId, token: toTokenDto(updated) });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.QUEUE.UPDATED, { clinicId });
    return updated;
  },

  async updateDelay(doctorId: string, clinicId: string, actorUserId: string, delayMinutes: number | null, delayReason: string | null | undefined) {
    const session = await queueRepository.findSession(doctorId, clinicId);
    if (!session) {
      throw new NotFoundError('Queue session');
    }
    const updated = await queueRepository.updateSession(session.id, {
      delayMinutes,
      delayReason: delayReason || null,
      delayUpdatedAt: new Date(),
      delayUpdatedBy: actorUserId,
    });

    recordAuditLog({ actorUserId, action: 'queue.delay_updated', entityType: 'DoctorSession', entityId: session.id, clinicId, metadata: { doctorId, delayMinutes, delayReason } });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.DELAY.UPDATED, { clinicId, delayMinutes, delayReason: delayReason || null });
    return updated;
  },

  async updatePriority(doctorId: string, clinicId: string, actorUserId: string, tokenId: string, priority: TokenPriority) {
    const token = await requireOwnedToken(doctorId, clinicId, tokenId);
    if (token.status !== 'WAITING') {
      throw new ConflictError('Only a waiting patient\'s priority can be changed');
    }
    const updated = await queueRepository.updateToken(tokenId, { priority });

    recordAuditLog({
      actorUserId,
      action: 'queue.priority_updated',
      entityType: 'QueueToken',
      entityId: tokenId,
      clinicId,
      metadata: { doctorId, previousState: { priority: token.priority }, newState: { priority } },
    });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.QUEUE.UPDATED, { clinicId });
    return updated;
  },
};

export const queueService = {
  async getSnapshot(userId: string, clinicId: string) {
    const doctor = await resolveDoctorOrThrow(userId);
    const membership = await assertClinicMembership(doctor.id, clinicId);
    return buildSnapshot(doctor.id, clinicId, membership.canOverrideDelay);
  },

  async startSession(userId: string, clinicId: string) {
    const doctor = await resolveDoctorOrThrow(userId);
    const membership = await assertClinicMembership(doctor.id, clinicId);
    await doctorQueueEngine.startSession(doctor.id, clinicId, userId);
    return buildSnapshot(doctor.id, clinicId, membership.canOverrideDelay);
  },

  async pauseSession(userId: string, clinicId: string) {
    const doctor = await resolveDoctorOrThrow(userId);
    const membership = await assertClinicMembership(doctor.id, clinicId);
    await doctorQueueEngine.pauseSession(doctor.id, clinicId, userId);
    return buildSnapshot(doctor.id, clinicId, membership.canOverrideDelay);
  },

  async resumeSession(userId: string, clinicId: string) {
    const doctor = await resolveDoctorOrThrow(userId);
    const membership = await assertClinicMembership(doctor.id, clinicId);
    await doctorQueueEngine.resumeSession(doctor.id, clinicId, userId);
    return buildSnapshot(doctor.id, clinicId, membership.canOverrideDelay);
  },

  async callNext(userId: string, clinicId: string) {
    const doctor = await resolveDoctorOrThrow(userId);
    const membership = await assertClinicMembership(doctor.id, clinicId);
    await doctorQueueEngine.callNext(doctor.id, clinicId, userId);
    return buildSnapshot(doctor.id, clinicId, membership.canOverrideDelay);
  },

  async repeatCall(userId: string, clinicId: string, tokenId: string) {
    const doctor = await resolveDoctorOrThrow(userId);
    const membership = await assertClinicMembership(doctor.id, clinicId);
    await doctorQueueEngine.repeatCall(doctor.id, clinicId, userId, tokenId);
    return buildSnapshot(doctor.id, clinicId, membership.canOverrideDelay);
  },

  async skip(userId: string, clinicId: string, tokenId: string, reason: string | undefined) {
    const doctor = await resolveDoctorOrThrow(userId);
    const membership = await assertClinicMembership(doctor.id, clinicId);
    await doctorQueueEngine.skip(doctor.id, clinicId, userId, tokenId, reason);
    return buildSnapshot(doctor.id, clinicId, membership.canOverrideDelay);
  },

  async updateDelay(userId: string, clinicId: string, delayMinutes: number | null, delayReason: string | null | undefined) {
    const doctor = await resolveDoctorOrThrow(userId);
    const membership = await assertClinicMembership(doctor.id, clinicId);
    if (!membership.canOverrideDelay) {
      throw new ForbiddenError('Delay updates are controlled by reception for this clinic');
    }
    await doctorQueueEngine.updateDelay(doctor.id, clinicId, userId, delayMinutes, delayReason);
    return buildSnapshot(doctor.id, clinicId, membership.canOverrideDelay);
  },
};

export { sortByQueueOrder };
