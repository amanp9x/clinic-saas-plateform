import { AppointmentStatus, type Prisma, type TokenStatus } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { startOfDay } from '../../utils/date.js';

const tokenInclude = { patient: true } satisfies Prisma.QueueTokenInclude;
export type TokenWithPatient = Prisma.QueueTokenGetPayload<{ include: typeof tokenInclude }>;

function endOfToday(): Date {
  return new Date(startOfDay().getTime() + 24 * 60 * 60 * 1000 - 1);
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

  findNextWaiting(sessionId: string): Promise<TokenWithPatient | null> {
    return prisma.queueToken.findFirst({
      where: { doctorSessionId: sessionId, status: 'WAITING' },
      orderBy: { tokenNumber: 'asc' },
      include: tokenInclude,
    });
  },

  countByStatus(sessionId: string, status: TokenStatus) {
    return prisma.queueToken.count({ where: { doctorSessionId: sessionId, status } });
  },

  countWaitingAhead(sessionId: string, tokenNumber: number) {
    return prisma.queueToken.count({
      where: { doctorSessionId: sessionId, status: 'WAITING', tokenNumber: { lt: tokenNumber } },
    });
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
