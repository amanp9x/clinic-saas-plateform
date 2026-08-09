import { SOCKET_EVENTS } from '@clinic/shared';
import { queueRepository } from './queue.repository.js';
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

export const queueService = {
  async getSnapshot(userId: string, clinicId: string) {
    const doctor = await resolveDoctorOrThrow(userId);
    const membership = await assertClinicMembership(doctor.id, clinicId);
    return buildSnapshot(doctor.id, clinicId, membership.canOverrideDelay);
  },

  async startSession(userId: string, clinicId: string) {
    const doctor = await resolveDoctorOrThrow(userId);
    const membership = await assertClinicMembership(doctor.id, clinicId);

    let session = await queueRepository.findSession(doctor.id, clinicId);
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
      : await queueRepository.createSession(doctor.id, clinicId);

    const unqueued = await queueRepository.listUnqueuedAppointmentsForToday(doctor.id, clinicId);
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

    recordAuditLog({ actorUserId: userId, action: 'doctor.session_started', entityType: 'DoctorSession', entityId: session.id });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.DOCTOR.SESSION_STARTED, { clinicId, sessionId: session.id });
    return buildSnapshot(doctor.id, clinicId, membership.canOverrideDelay);
  },

  async pauseSession(userId: string, clinicId: string) {
    const doctor = await resolveDoctorOrThrow(userId);
    const membership = await assertClinicMembership(doctor.id, clinicId);
    const session = await queueRepository.findSession(doctor.id, clinicId);
    if (!session || session.queueStatus !== 'ACTIVE') {
      throw new ConflictError('The queue is not currently active');
    }
    await queueRepository.updateSession(session.id, { queueStatus: 'PAUSED' });
    recordAuditLog({ actorUserId: userId, action: 'doctor.session_paused', entityType: 'DoctorSession', entityId: session.id });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.DOCTOR.SESSION_PAUSED, { clinicId });
    return buildSnapshot(doctor.id, clinicId, membership.canOverrideDelay);
  },

  async resumeSession(userId: string, clinicId: string) {
    const doctor = await resolveDoctorOrThrow(userId);
    const membership = await assertClinicMembership(doctor.id, clinicId);
    const session = await queueRepository.findSession(doctor.id, clinicId);
    if (!session || session.queueStatus !== 'PAUSED') {
      throw new ConflictError('The queue is not currently paused');
    }
    await queueRepository.updateSession(session.id, { queueStatus: 'ACTIVE' });
    recordAuditLog({ actorUserId: userId, action: 'doctor.session_resumed', entityType: 'DoctorSession', entityId: session.id });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.DOCTOR.SESSION_RESUMED, { clinicId });
    return buildSnapshot(doctor.id, clinicId, membership.canOverrideDelay);
  },

  async callNext(userId: string, clinicId: string) {
    const doctor = await resolveDoctorOrThrow(userId);
    const membership = await assertClinicMembership(doctor.id, clinicId);
    const session = await queueRepository.findSession(doctor.id, clinicId);
    if (!session || session.queueStatus !== 'ACTIVE') {
      throw new ConflictError('Start the queue session before calling patients');
    }
    const next = await queueRepository.findNextWaiting(session.id);
    if (!next) {
      throw new NotFoundError('No waiting patients');
    }
    const called = await queueRepository.updateToken(next.id, {
      status: 'CALLED',
      calledAt: new Date(),
      calledCount: { increment: 1 },
    });
    await queueRepository.updateSession(session.id, { currentTokenId: called.id });

    recordAuditLog({ actorUserId: userId, action: 'doctor.patient_called', entityType: 'QueueToken', entityId: called.id });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.PATIENT.CALLED, { clinicId, token: toTokenDto(called), recalled: false });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.QUEUE.UPDATED, { clinicId });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.DOCTOR.QUEUE_UPDATED, { clinicId });
    return buildSnapshot(doctor.id, clinicId, membership.canOverrideDelay);
  },

  async repeatCall(userId: string, clinicId: string, tokenId: string) {
    const doctor = await resolveDoctorOrThrow(userId);
    const membership = await assertClinicMembership(doctor.id, clinicId);
    const token = await requireOwnedToken(doctor.id, clinicId, tokenId);
    if (token.status !== 'CALLED') {
      throw new ConflictError('Only a currently-called patient can be re-called');
    }
    const updated = await queueRepository.updateToken(tokenId, { calledAt: new Date(), calledCount: { increment: 1 } });

    recordAuditLog({ actorUserId: userId, action: 'doctor.patient_recalled', entityType: 'QueueToken', entityId: tokenId });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.PATIENT.CALLED, { clinicId, token: toTokenDto(updated), recalled: true });
    return buildSnapshot(doctor.id, clinicId, membership.canOverrideDelay);
  },

  async skip(userId: string, clinicId: string, tokenId: string, reason: string | undefined) {
    const doctor = await resolveDoctorOrThrow(userId);
    const membership = await assertClinicMembership(doctor.id, clinicId);
    const token = await requireOwnedToken(doctor.id, clinicId, tokenId);
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

    recordAuditLog({ actorUserId: userId, action: 'doctor.patient_skipped', entityType: 'QueueToken', entityId: tokenId, metadata: { reason } });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.PATIENT.SKIPPED, { clinicId, token: toTokenDto(updated) });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.QUEUE.UPDATED, { clinicId });
    return buildSnapshot(doctor.id, clinicId, membership.canOverrideDelay);
  },

  async updateDelay(userId: string, clinicId: string, delayMinutes: number | null, delayReason: string | null | undefined) {
    const doctor = await resolveDoctorOrThrow(userId);
    const membership = await assertClinicMembership(doctor.id, clinicId);
    if (!membership.canOverrideDelay) {
      throw new ForbiddenError('Delay updates are controlled by reception for this clinic');
    }
    const session = await queueRepository.findSession(doctor.id, clinicId);
    if (!session) {
      throw new NotFoundError('Queue session');
    }
    await queueRepository.updateSession(session.id, {
      delayMinutes,
      delayReason: delayReason || null,
      delayUpdatedAt: new Date(),
      delayUpdatedBy: userId,
    });

    recordAuditLog({ actorUserId: userId, action: 'doctor.delay_updated', entityType: 'DoctorSession', entityId: session.id, metadata: { delayMinutes, delayReason } });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.DELAY.UPDATED, { clinicId, delayMinutes, delayReason: delayReason || null });
    return buildSnapshot(doctor.id, clinicId, membership.canOverrideDelay);
  },
};
