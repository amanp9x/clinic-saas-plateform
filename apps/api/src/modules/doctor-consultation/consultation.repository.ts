import type { Consultation, Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';

export const consultationRepository = {
  findByAppointmentId(appointmentId: string) {
    return prisma.consultation.findUnique({ where: { appointmentId } });
  },

  update(appointmentId: string, data: Prisma.ConsultationUpdateInput): Promise<Consultation> {
    return prisma.consultation.update({ where: { appointmentId }, data });
  },
};
