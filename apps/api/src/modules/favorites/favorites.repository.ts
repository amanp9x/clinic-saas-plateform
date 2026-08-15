import { prisma } from '../../config/database.js';
import { doctorCardInclude } from '../catalog/catalog.repository.js';

const clinicCardIncludeForFavorites = {
  _count: { select: { doctors: { where: { isActive: true } } } },
} as const;

export const favoritesRepository = {
  findByPatientAndDoctor(patientId: string, doctorId: string) {
    return prisma.favorite.findUnique({
      where: { patientId_doctorId: { patientId, doctorId } },
    });
  },

  findByPatientAndClinic(patientId: string, clinicId: string) {
    return prisma.favorite.findUnique({
      where: { patientId_clinicId: { patientId, clinicId } },
    });
  },

  createDoctorFavorite(patientId: string, doctorId: string) {
    return prisma.favorite.create({ data: { patientId, doctorId } });
  },

  createClinicFavorite(patientId: string, clinicId: string) {
    return prisma.favorite.create({ data: { patientId, clinicId } });
  },

  deleteById(id: string) {
    return prisma.favorite.delete({ where: { id } });
  },

  findActiveDoctor(doctorId: string) {
    return prisma.doctor.findFirst({ where: { id: doctorId, isActive: true }, select: { id: true } });
  },

  findActiveClinic(clinicId: string) {
    return prisma.clinic.findFirst({ where: { id: clinicId, isActive: true }, select: { id: true } });
  },

  async listByPatient(patientId: string) {
    const [doctorFavorites, clinicFavorites] = await Promise.all([
      prisma.favorite.findMany({
        where: { patientId, doctorId: { not: null } },
        include: { doctor: { include: doctorCardInclude } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.favorite.findMany({
        where: { patientId, clinicId: { not: null } },
        include: { clinic: { include: clinicCardIncludeForFavorites } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { doctorFavorites, clinicFavorites };
  },
};
