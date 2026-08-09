import { prisma } from '../../config/database.js';

export const doctorPatientsRepository = {
  findPatient(patientId: string) {
    return prisma.patient.findUnique({ where: { id: patientId }, include: { user: true } });
  },

  async hasCareRelationship(doctorId: string, patientId: string): Promise<boolean> {
    const count = await prisma.appointment.count({ where: { doctorId, patientId } });
    return count > 0;
  },

  /** Full cross-doctor appointment history for continuity of care — not scoped to `doctorId`. */
  listAppointments(patientId: string) {
    return prisma.appointment.findMany({
      where: { patientId },
      include: {
        doctor: { include: { specialization: true } },
        clinic: true,
        prescriptions: { select: { id: true } },
      },
      orderBy: { scheduledAt: 'desc' },
    });
  },
};
