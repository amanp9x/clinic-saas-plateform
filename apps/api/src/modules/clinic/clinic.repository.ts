import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';

export const clinicRepository = {
  findById(clinicId: string) {
    return prisma.clinic.findUnique({ where: { id: clinicId } });
  },

  update(clinicId: string, data: Prisma.ClinicUpdateInput) {
    return prisma.clinic.update({ where: { id: clinicId }, data });
  },

  findSettings(clinicId: string) {
    return prisma.clinicSettings.findUnique({ where: { clinicId } });
  },

  upsertSettings(clinicId: string, data: Prisma.ClinicSettingsUpdateInput) {
    return prisma.clinicSettings.upsert({
      where: { clinicId },
      update: data,
      create: { ...(data as Prisma.ClinicSettingsUncheckedCreateInput), clinicId },
    });
  },

  createDocument(data: Prisma.ClinicDocumentUncheckedCreateInput) {
    return prisma.clinicDocument.create({ data, include: { uploadedBy: true } });
  },

  listDocuments(clinicId: string) {
    return prisma.clinicDocument.findMany({
      where: { clinicId },
      include: { uploadedBy: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  findDocument(id: string, clinicId: string) {
    return prisma.clinicDocument.findFirst({ where: { id, clinicId }, include: { uploadedBy: true } });
  },

  deleteDocument(id: string) {
    return prisma.clinicDocument.delete({ where: { id } });
  },

  updateDocumentExpiry(id: string, expiryDate: Date | null) {
    return prisma.clinicDocument.update({ where: { id }, data: { expiryDate }, include: { uploadedBy: true } });
  },
};
