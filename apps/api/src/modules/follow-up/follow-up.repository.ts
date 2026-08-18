import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';

const rowInclude = {
  patient: { select: { id: true, fullName: true, user: { select: { phone: true } } } },
  doctor: { select: { id: true, displayName: true } },
  clinic: { select: { id: true, name: true } },
} satisfies Prisma.ConsultationInclude;

export type FollowUpRowWithRelations = Prisma.ConsultationGetPayload<{ include: typeof rowInclude }>;

/** Operational window for the "due follow-ups" lists — far enough back to still be actionable
 * (reception can call an overdue patient), not an unbounded historical query. Not a compliance
 * record; see FollowUpRowDto's `isOverdue` doc comment for the tracking limitation. */
function followUpWindow(now: Date): Prisma.ConsultationWhereInput['followUpDate'] {
  return { not: null, gte: new Date(now.getTime() - 30 * 24 * 60 * 60_000) };
}

export const followUpRepository = {
  async listDueForDoctor(doctorId: string, filters: { clinicId?: string; page: number; limit: number }, now = new Date()) {
    const where: Prisma.ConsultationWhereInput = { doctorId, clinicId: filters.clinicId, followUpDate: followUpWindow(now) };
    const [items, total] = await Promise.all([
      prisma.consultation.findMany({
        where,
        include: rowInclude,
        orderBy: { followUpDate: 'asc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.consultation.count({ where }),
    ]);
    return { items, total };
  },

  async listDueForClinic(clinicId: string, filters: { doctorId?: string; page: number; limit: number }, now = new Date()) {
    const where: Prisma.ConsultationWhereInput = { clinicId, doctorId: filters.doctorId, followUpDate: followUpWindow(now) };
    const [items, total] = await Promise.all([
      prisma.consultation.findMany({
        where,
        include: rowInclude,
        orderBy: { followUpDate: 'asc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.consultation.count({ where }),
    ]);
    return { items, total };
  },

  findConsultationForAppointment(appointmentId: string) {
    return prisma.consultation.findUnique({ where: { appointmentId } });
  },

  findPrescriptionForAppointment(appointmentId: string) {
    return prisma.prescription.findFirst({
      where: { appointmentId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { issuedAt: 'desc' },
    });
  },
};
