import type { Clinic, DoctorSession } from '@prisma/client';
import type { QueueHistoryEventDto, ReceptionQueueSnapshotDto, ReceptionQueueTokenDto } from '@clinic/shared';
import { sortByQueueOrder, type TokenWithPatient } from '../doctor-queue/queue.repository.js';
import { toTokenDto } from '../doctor-queue/queue.mappers.js';
import { calculateEta } from '../queue-engine/eta.service.js';

type SessionEtaContext = Pick<DoctorSession, 'averageConsultationMinutes' | 'delayMinutes' | 'queueStatus' | 'status'>;

export function toReceptionTokenDto(
  token: TokenWithPatient,
  patientsAhead: number | null,
  session: SessionEtaContext,
): ReceptionQueueTokenDto {
  return {
    ...toTokenDto(token),
    priority: token.priority,
    patientsAhead,
    etaMinutes: calculateEta({
      patientsAhead,
      avgConsultationMinutes: session.averageConsultationMinutes,
      delayMinutes: session.delayMinutes,
      queueStatus: session.queueStatus,
      doctorStatus: session.status,
    }),
  };
}

export function toReceptionQueueSnapshot(
  session: (DoctorSession & { clinic: Clinic; tokens: TokenWithPatient[] }) | null,
  permissions: { canUpdateDelay: boolean; canUpdatePriority: boolean },
): ReceptionQueueSnapshotDto {
  if (!session) {
    return {
      session: null,
      pauseReason: null,
      currentToken: null,
      nextToken: null,
      waitingTokens: [],
      calledTokens: [],
      queueLength: 0,
      completedTodayCount: 0,
      skippedTodayCount: 0,
      estimatedWaitMinutes: null,
      canUpdateDelay: permissions.canUpdateDelay,
      canUpdatePriority: permissions.canUpdatePriority,
    };
  }

  const waitingSorted = sortByQueueOrder(session.tokens.filter((t) => t.status === 'WAITING'));
  const waitingTokens = waitingSorted.map((t, i) => toReceptionTokenDto(t, i, session));
  const calledTokens = session.tokens.filter((t) => t.status === 'CALLED').map((t) => toReceptionTokenDto(t, 0, session));

  const currentTokenRaw = session.currentTokenId ? (session.tokens.find((t) => t.id === session.currentTokenId) ?? null) : null;
  const currentToken = currentTokenRaw
    ? toReceptionTokenDto(currentTokenRaw, currentTokenRaw.status === 'WAITING' ? waitingSorted.indexOf(currentTokenRaw) : 0, session)
    : null;

  const nextTokenRaw = waitingSorted[0] ?? null;
  const nextToken = nextTokenRaw ? toReceptionTokenDto(nextTokenRaw, 0, session) : null;

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
    pauseReason: session.pauseReason,
    currentToken,
    nextToken,
    waitingTokens,
    calledTokens,
    queueLength: waitingTokens.length + calledTokens.length,
    completedTodayCount: session.tokens.filter((t) => t.status === 'COMPLETED').length,
    skippedTodayCount: session.tokens.filter((t) => t.status === 'SKIPPED').length,
    estimatedWaitMinutes: nextToken?.etaMinutes ?? null,
    canUpdateDelay: permissions.canUpdateDelay,
    canUpdatePriority: permissions.canUpdatePriority,
  };
}

export function toQueueHistoryEvent(row: {
  id: string;
  action: string;
  actorUserId: string | null;
  actorName: string | null;
  clinicId: string | null;
  metadata: unknown;
  createdAt: Date;
}): QueueHistoryEventDto {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    action: row.action,
    actorUserId: row.actorUserId,
    actorName: row.actorName,
    clinicId: row.clinicId,
    doctorId: typeof metadata.doctorId === 'string' ? metadata.doctorId : null,
    patientId: typeof metadata.patientId === 'string' ? metadata.patientId : null,
    tokenId: typeof metadata.tokenId === 'string' ? metadata.tokenId : null,
    previousState: (metadata.previousState as Record<string, unknown> | undefined) ?? null,
    newState: (metadata.newState as Record<string, unknown> | undefined) ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
