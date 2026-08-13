import { AppointmentStatus, type Prisma, type TokenPriority, type TokenStatus } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { startOfDay } from '../../utils/date.js';

const tokenInclude = { patient: true } satisfies Prisma.QueueTokenInclude;
export type TokenWithPatient = Prisma.QueueTokenGetPayload<{ include: typeof tokenInclude }>;

function endOfToday(): Date {
  return new Date(startOfDay().getTime() + 24 * 60 * 60 * 1000 - 1);
}

export function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'P2002';
}

/** Deterministic queue order: priority tier first (EMERGENCY highest), then token number.
 * Reused everywhere queue order matters — call-next, snapshot lists, patient's "ahead of me"
 * count — so there is exactly one definition of "queue order" in the codebase. */
const PRIORITY_RANK: Record<TokenPriority, number> = {
  EMERGENCY: 0,
  URGENT: 1,
  FOLLOW_UP: 2,
  NORMAL: 3,
};

export function compareQueueOrder(a: { priority: TokenPriority; tokenNumber: number }, b: { priority: TokenPriority; tokenNumber: number }): number {
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.tokenNumber - b.tokenNumber;
}

export function sortByQueueOrder<T extends { priority: TokenPriority; tokenNumber: number }>(tokens: T[]): T[] {
  return [...tokens].sort(compareQueueOrder);
}

export const queueRepository = {
  findSession(doctorId: string, clinicId: string, sessionDate: Date = startOfDay()) {
    return prisma.doctorSession.findUnique({
      where: { doctorId_clinicId_sessionDate: { doctorId, clinicId, sessionDate } },
      include: { clinic: true },
    });
  },

  findSessionWithTokens(doctorId: string, clinicId: string, sessionDate: Date = startOfDay()) {
    return prisma.doctorSession.findUnique({
      where: { doctorId_clinicId_sessionDate: { doctorId, clinicId, sessionDate } },
      include: {
        clinic: true,
        tokens: { include: tokenInclude, orderBy: { tokenNumber: 'asc' } },
      },
    });
  },

  createSession(doctorId: string, clinicId: string, sessionDate: Date = startOfDay()) {
    return prisma.doctorSession.create({
      data: {
        doctorId,
        clinicId,
        sessionDate,
        queueStatus: 'ACTIVE',
        status: 'AVAILABLE',
        startedAt: new Date(),
      },
      include: { clinic: true },
    });
  },

  updateSession(id: string, data: Prisma.DoctorSessionUpdateInput) {
    return prisma.doctorSession.update({ where: { id }, data, include: { clinic: true } });
  },

  nextTokenNumber(sessionId: string): Promise<number> {
    return prisma.queueToken.count({ where: { doctorSessionId: sessionId } }).then((n) => n + 1);
  },

  createToken(data: Prisma.QueueTokenUncheckedCreateInput): Promise<TokenWithPatient> {
    return prisma.queueToken.create({ data, include: tokenInclude });
  },

  /** Concurrency-safe token creation: recomputes the next token number and retries on a
   * `@@unique([doctorSessionId, tokenNumber])` collision, so two receptionists creating a
   * check-in/walk-in token for the same session at the same instant never fail outright —
   * one simply gets the next number after the other. */
  async createTokenWithRetry(
    sessionId: string,
    build: (tokenNumber: number) => Omit<Prisma.QueueTokenUncheckedCreateInput, 'doctorSessionId' | 'tokenNumber'>,
    maxAttempts = 5,
  ): Promise<TokenWithPatient> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const tokenNumber = await queueRepository.nextTokenNumber(sessionId);
      try {
        return await queueRepository.createToken({
          ...build(tokenNumber),
          doctorSessionId: sessionId,
          tokenNumber,
        });
      } catch (err) {
        if (isUniqueConstraintError(err) && attempt < maxAttempts - 1) continue;
        throw err;
      }
    }
    throw new Error('Could not allocate a queue token — please retry');
  },

  /** Atomically claims a token only if it is still in `guardStatus`, so two receptionists
   * calling "Call Next" (or completing/skipping) at the same instant can never both succeed
   * on the same token — the loser's `count` is 0 and the caller retries against the new state. */
  async claimToken(tokenId: string, guardStatus: TokenStatus, data: Prisma.QueueTokenUncheckedUpdateManyInput): Promise<boolean> {
    const result = await prisma.queueToken.updateMany({ where: { id: tokenId, status: guardStatus }, data });
    return result.count === 1;
  },

  findToken(id: string) {
    return prisma.queueToken.findUnique({ where: { id }, include: { patient: true, doctorSession: true } });
  },

  findTokenByAppointmentId(appointmentId: string) {
    return prisma.queueToken.findUnique({
      where: { appointmentId },
      include: { patient: true, doctorSession: true },
    });
  },

  updateToken(id: string, data: Prisma.QueueTokenUpdateInput): Promise<TokenWithPatient> {
    return prisma.queueToken.update({ where: { id }, data, include: tokenInclude });
  },

  async listWaitingOrdered(sessionId: string): Promise<TokenWithPatient[]> {
    const tokens = await prisma.queueToken.findMany({
      where: { doctorSessionId: sessionId, status: 'WAITING' },
      include: tokenInclude,
    });
    return sortByQueueOrder(tokens);
  },

  async findNextWaiting(sessionId: string): Promise<TokenWithPatient | null> {
    const waiting = await queueRepository.listWaitingOrdered(sessionId);
    return waiting[0] ?? null;
  },

  countByStatus(sessionId: string, status: TokenStatus) {
    return prisma.queueToken.count({ where: { doctorSessionId: sessionId, status } });
  },

  /** Number of WAITING tokens that would be called before this one, respecting priority order. */
  async countWaitingAhead(sessionId: string, token: { id: string; priority: TokenPriority; tokenNumber: number }) {
    const waiting = await queueRepository.listWaitingOrdered(sessionId);
    const index = waiting.findIndex((t) => t.id === token.id);
    if (index >= 0) return index;
    // Token isn't itself WAITING (e.g. computing ahead-count for a CALLED/COMPLETED token) —
    // count how many WAITING tokens sort strictly before its (priority, tokenNumber) position.
    return waiting.filter((t) => compareQueueOrder(t, token) < 0).length;
  },

  countTotalTokens(sessionId: string) {
    return prisma.queueToken.count({ where: { doctorSessionId: sessionId } });
  },

  /** Today's confirmed/checked-in appointments at this clinic that don't already have a token
   * (i.e. haven't been pulled into a queue session yet). */
  listUnqueuedAppointmentsForToday(doctorId: string, clinicId: string) {
    return prisma.appointment.findMany({
      where: {
        doctorId,
        clinicId,
        scheduledAt: { gte: startOfDay(), lte: endOfToday() },
        status: { in: [AppointmentStatus.CONFIRMED, AppointmentStatus.CHECKED_IN] },
        queueToken: null,
      },
      orderBy: { scheduledAt: 'asc' },
    });
  },
};
