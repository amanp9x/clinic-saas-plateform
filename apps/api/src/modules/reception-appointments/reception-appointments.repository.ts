import { AppointmentStatus, type Prisma } from '@prisma/client';
import type { ReceptionAppointmentTab } from '@clinic/shared';
import { prisma } from '../../config/database.js';
import { endOfDay, startOfDay } from '../../utils/date.js';

const appointmentInclude = {
  patient: { include: { user: true } },
  doctor: true,
  queueToken: true,
  payment: { select: { id: true, status: true } },
} satisfies Prisma.AppointmentInclude;

export type ReceptionAppointmentWithRelations = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>;

function whereForTab(clinicId: string, tab: ReceptionAppointmentTab, doctorId?: string): Prisma.AppointmentWhereInput {
  const base: Prisma.AppointmentWhereInput = { clinicId, ...(doctorId ? { doctorId } : {}) };
  switch (tab) {
    case 'upcoming':
      return { ...base, scheduledAt: { gt: endOfDay() }, status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW, AppointmentStatus.COMPLETED] } };
    case 'all':
      return base;
    case 'today':
    default:
      return { ...base, scheduledAt: { gte: startOfDay(), lte: endOfDay() } };
  }
}

export const receptionAppointmentsRepository = {
  async list(clinicId: string, tab: ReceptionAppointmentTab, doctorId: string | undefined, page: number, limit: number) {
    const where = whereForTab(clinicId, tab, doctorId);
    const [items, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: appointmentInclude,
        orderBy: { scheduledAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.appointment.count({ where }),
    ]);
    return { items, total };
  },

  findByIdForClinic(id: string, clinicId: string) {
    return prisma.appointment.findFirst({ where: { id, clinicId }, include: appointmentInclude });
  },

  async searchPatients(clinicId: string, q: string, page: number, limit: number) {
    const where: Prisma.PatientWhereInput = {
      appointments: { some: { clinicId } },
      OR: [
        { fullName: { contains: q, mode: 'insensitive' } },
        { user: { phone: { contains: q } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ],
    };
    const [items, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        include: { user: true, appointments: { where: { clinicId }, orderBy: { scheduledAt: 'desc' }, take: 1 } },
        orderBy: { fullName: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.patient.count({ where }),
    ]);
    return { items, total };
  },

  findPatientForClinic(patientId: string, clinicId: string) {
    return prisma.patient.findFirst({
      where: { id: patientId, appointments: { some: { clinicId } } },
      include: {
        user: true,
        appointments: {
          where: { clinicId, scheduledAt: { gte: startOfDay(), lte: endOfDay() } },
          include: { doctor: true, queueToken: true, payment: { select: { id: true, status: true } } },
          orderBy: { scheduledAt: 'desc' },
          take: 1,
        },
      },
    });
  },
};
