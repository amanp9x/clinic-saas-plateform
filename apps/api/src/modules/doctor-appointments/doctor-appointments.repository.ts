import { AppointmentStatus, type Prisma } from '@prisma/client';
import type { DoctorAppointmentTab } from '@clinic/shared';
import { prisma } from '../../config/database.js';
import { endOfDay, startOfDay } from '../../utils/date.js';

const detailInclude = {
  patient: { include: { user: true } },
  clinic: true,
  prescriptions: { select: { id: true } },
  consultation: { select: { status: true } },
  payment: { select: { id: true, status: true } },
} satisfies Prisma.AppointmentInclude;

export type DoctorAppointmentWithRelations = Prisma.AppointmentGetPayload<{ include: typeof detailInclude }>;

function whereForTab(doctorId: string, tab: DoctorAppointmentTab, clinicId?: string): Prisma.AppointmentWhereInput {
  const base: Prisma.AppointmentWhereInput = { doctorId, ...(clinicId ? { clinicId } : {}) };

  switch (tab) {
    case 'past':
      return { ...base, status: AppointmentStatus.COMPLETED };
    case 'cancelled':
      return { ...base, status: AppointmentStatus.CANCELLED };
    case 'no-show':
      return { ...base, status: AppointmentStatus.NO_SHOW };
    case 'upcoming':
      return {
        ...base,
        scheduledAt: { gt: endOfDay() },
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW, AppointmentStatus.COMPLETED] },
      };
    case 'today':
    default:
      return {
        ...base,
        scheduledAt: { gte: startOfDay(), lte: endOfDay() },
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
      };
  }
}

export const doctorAppointmentsRepository = {
  async list(doctorId: string, tab: DoctorAppointmentTab, clinicId: string | undefined, page: number, limit: number) {
    const where = whereForTab(doctorId, tab, clinicId);
    const orderBy: Prisma.AppointmentOrderByWithRelationInput =
      tab === 'past' || tab === 'cancelled' || tab === 'no-show' ? { scheduledAt: 'desc' } : { scheduledAt: 'asc' };

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

  findById(id: string, doctorId: string) {
    return prisma.appointment.findFirst({ where: { id, doctorId }, include: detailInclude });
  },

  updateStatus(id: string, data: Prisma.AppointmentUpdateInput) {
    return prisma.appointment.update({ where: { id }, data, include: detailInclude });
  },
};
