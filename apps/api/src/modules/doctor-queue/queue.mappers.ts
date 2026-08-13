import type { Clinic, DoctorSession } from '@prisma/client';
import type { QueueSnapshotDto, QueueTokenDto } from '@clinic/shared';
import { sortByQueueOrder, type TokenWithPatient } from './queue.repository.js';

export function toTokenDto(token: TokenWithPatient): QueueTokenDto {
  return {
    id: token.id,
    tokenNumber: token.tokenNumber,
    type: token.type,
    status: token.status,
    patientId: token.patientId,
    patientName: token.patient.fullName,
    appointmentId: token.appointmentId,
    calledAt: token.calledAt ? token.calledAt.toISOString() : null,
    calledCount: token.calledCount,
    startedAt: token.startedAt ? token.startedAt.toISOString() : null,
    completedAt: token.completedAt ? token.completedAt.toISOString() : null,
    skipReason: token.skipReason,
    priority: token.priority,
  };
}

export function toQueueSnapshot(
  session: (DoctorSession & { clinic: Clinic; tokens: TokenWithPatient[] }) | null,
  canOverrideDelay: boolean,
): QueueSnapshotDto {
  if (!session) {
    return {
      session: null,
      currentToken: null,
      waitingTokens: [],
      calledTokens: [],
      queueLength: 0,
      completedTodayCount: 0,
      skippedTodayCount: 0,
      canOverrideDelay,
    };
  }

  const waitingTokens = sortByQueueOrder(session.tokens.filter((t) => t.status === 'WAITING')).map(toTokenDto);
  const calledTokens = session.tokens.filter((t) => t.status === 'CALLED').map(toTokenDto);
  const currentToken = session.currentTokenId
    ? toTokenDto(session.tokens.find((t) => t.id === session.currentTokenId) ?? session.tokens[0]!)
    : null;

  return {
    session: {
      id: session.id,
      doctorId: session.doctorId,
      clinicId: session.clinicId,
      clinicName: session.clinic.name,
      sessionDate: session.sessionDate.toISOString().slice(0, 10),
      status: session.status,
      queueStatus: session.queueStatus,
      startedAt: session.startedAt ? session.startedAt.toISOString() : null,
      endedAt: session.endedAt ? session.endedAt.toISOString() : null,
      currentTokenId: session.currentTokenId,
      averageConsultationMinutes: session.averageConsultationMinutes,
      delayMinutes: session.delayMinutes,
      delayReason: session.delayReason,
      delayUpdatedAt: session.delayUpdatedAt ? session.delayUpdatedAt.toISOString() : null,
    },
    currentToken: session.currentTokenId ? currentToken : null,
    waitingTokens,
    calledTokens,
    queueLength: waitingTokens.length + calledTokens.length,
    completedTodayCount: session.tokens.filter((t) => t.status === 'COMPLETED').length,
    skippedTodayCount: session.tokens.filter((t) => t.status === 'SKIPPED').length,
    canOverrideDelay,
  };
}
