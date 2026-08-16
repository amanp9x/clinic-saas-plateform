import { AppointmentStatus, type Prisma } from '@prisma/client';
import type { AppointmentTab } from '@clinic/shared';
import { prisma } from '../../config/database.js';

const detailInclude = {
  doctor: { include: { specialization: true } },
  clinic: true,
  prescriptions: { select: { id: true } },
  payment: { select: { id: true, status: true } },
} satisfies Prisma.AppointmentInclude;

export type AppointmentWithRelations = Prisma.AppointmentGetPayload<{ include: typeof detailInclude }>;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function whereForTab(patientId: string, tab: AppointmentTab): Prisma.AppointmentWhereInput {
  const now = new Date();

  switch (tab) {
    case 'today':
      return {
        patientId,
        scheduledAt: { gte: startOfDay(now), lte: endOfDay(now) },
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
      };
    case 'completed':
      return { patientId, status: AppointmentStatus.COMPLETED };
    case 'cancelled':
      return { patientId, status: { in: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] } };
    case 'upcoming':
    default:
      return {
        patientId,
        scheduledAt: { gt: endOfDay(now) },
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW, AppointmentStatus.COMPLETED] },
      };
  }
}

export const appointmentsRepository = {
  async list(patientId: string, tab: AppointmentTab, page: number, limit: number) {
    const where = whereForTab(patientId, tab);
    const orderBy: Prisma.AppointmentOrderByWithRelationInput =
      tab === 'completed' || tab === 'cancelled' ? { scheduledAt: 'desc' } : { scheduledAt: 'asc' };

    const [items, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: detailInclude,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.appointment.count({ where }),
    ]);
    return { items, total };
  },

  findById(id: string, patientId: string) {
    return prisma.appointment.findFirst({ where: { id, patientId }, include: detailInclude });
  },

  findUpcoming(patientId: string) {
    return prisma.appointment.findFirst({
      where: {
        patientId,
        scheduledAt: { gt: endOfDay(new Date()) },
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW, AppointmentStatus.COMPLETED] },
      },
      include: detailInclude,
      orderBy: { scheduledAt: 'asc' },
    });
  },

  findToday(patientId: string) {
    const now = new Date();
    return prisma.appointment.findFirst({
      where: {
        patientId,
        scheduledAt: { gte: startOfDay(now), lte: endOfDay(now) },
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
      },
      include: detailInclude,
      orderBy: { scheduledAt: 'asc' },
    });
  },

  cancel(id: string, reason: string) {
    return prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CANCELLED, cancelReason: reason, cancelledAt: new Date() },
      include: detailInclude,
    });
  },
};
