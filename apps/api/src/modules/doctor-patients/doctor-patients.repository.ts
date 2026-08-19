import type { LabReportStatus, Prisma } from '@prisma/client';
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
        payment: { select: { id: true, status: true } },
      },
      orderBy: { scheduledAt: 'desc' },
    });
  },

  createLabReport(patientId: string, data: { testName: string; labName: string | null; appointmentId: string | null; notes: string | null }) {
    return prisma.labReport.create({ data: { patientId, ...data } });
  },

  findLabReport(id: string, patientId: string) {
    return prisma.labReport.findFirst({ where: { id, patientId } });
  },

  updateLabReport(
    id: string,
    data: { status: LabReportStatus; reportDate: Date | null; notes: string | null; fileUrl: string | null },
  ) {
    return prisma.labReport.update({ where: { id }, data });
  },

  createVaccination(
    patientId: string,
    data: Omit<Prisma.VaccinationUncheckedCreateInput, 'patientId'>,
  ) {
    return prisma.vaccination.create({ data: { patientId, ...data } });
  },
};
