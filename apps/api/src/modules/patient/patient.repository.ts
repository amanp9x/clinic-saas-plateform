import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';

export const patientRepository = {
  findByUserId(userId: string) {
    return prisma.patient.findUnique({
      where: { userId },
      include: { user: true, addresses: { orderBy: { isDefault: 'desc' } } },
    });
  },

  findByUserIdOrThrow(userId: string) {
    return prisma.patient.findUniqueOrThrow({
      where: { userId },
      include: { user: true, addresses: { orderBy: { isDefault: 'desc' } } },
    });
  },

  updateProfile(patientId: string, data: Prisma.PatientUpdateInput) {
    return prisma.patient.update({ where: { id: patientId }, data });
  },

  updateProfileImage(patientId: string, profileImageUrl: string | null) {
    return prisma.patient.update({ where: { id: patientId }, data: { profileImageUrl } });
  },

  listAddresses(patientId: string) {
    return prisma.patientAddress.findMany({
      where: { patientId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  },

  findAddress(id: string, patientId: string) {
    return prisma.patientAddress.findFirst({ where: { id, patientId } });
  },

  createAddress(patientId: string, data: Omit<Prisma.PatientAddressUncheckedCreateInput, 'patientId'>) {
    return prisma.patientAddress.create({ data: { ...data, patientId } });
  },

  updateAddress(id: string, data: Prisma.PatientAddressUpdateInput) {
    return prisma.patientAddress.update({ where: { id }, data });
  },

  deleteAddress(id: string) {
    return prisma.patientAddress.delete({ where: { id } });
  },

  clearDefaultAddresses(patientId: string, exceptId?: string) {
    return prisma.patientAddress.updateMany({
      where: { patientId, isDefault: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
      data: { isDefault: false },
    });
  },
};
