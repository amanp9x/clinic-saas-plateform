import { prisma } from '../../config/database.js';

export const medicalRecordsRepository = {
  listHistory(patientId: string) {
    return prisma.medicalRecord.findMany({ where: { patientId }, orderBy: { recordDate: 'desc' } });
  },

  listPrescriptions(patientId: string) {
    return prisma.prescription.findMany({
      where: { patientId },
      include: { doctor: true },
      orderBy: { issuedAt: 'desc' },
    });
  },

  listLabReports(patientId: string) {
    return prisma.labReport.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' } });
  },

  listVaccinations(patientId: string) {
    return prisma.vaccination.findMany({ where: { patientId }, orderBy: { administeredDate: 'desc' } });
  },

  listVitals(patientId: string) {
    return prisma.vitalRecord.findMany({ where: { patientId }, orderBy: { recordedAt: 'desc' } });
  },
};
