import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';

const associationInclude = {
  doctor: { include: { specialization: true } },
  department: true,
} satisfies Prisma.ClinicDoctorInclude;

export type ClinicDoctorWithRelations = Prisma.ClinicDoctorGetPayload<{ include: typeof associationInclude }>;

export const clinicDoctorsRepository = {
  async searchDoctors(q: string) {
    return prisma.doctor.findMany({
      where: { displayName: { contains: q, mode: 'insensitive' }, isActive: true },
      include: { specialization: true },
      take: 20,
      orderBy: { displayName: 'asc' },
    });
  },

  findAssociation(clinicId: string, doctorId: string) {
    return prisma.clinicDoctor.findUnique({
      where: { clinicId_doctorId: { clinicId, doctorId } },
      include: associationInclude,
    });
  },

  findAssociationById(id: string, clinicId: string) {
    return prisma.clinicDoctor.findFirst({ where: { id, clinicId }, include: associationInclude });
  },

  async list(clinicId: string, q: string | undefined, page: number, limit: number) {
    const where: Prisma.ClinicDoctorWhereInput = {
      clinicId,
      ...(q ? { doctor: { displayName: { contains: q, mode: 'insensitive' } } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.clinicDoctor.findMany({
        where,
        include: associationInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.clinicDoctor.count({ where }),
    ]);
    return { items, total };
  },

  create(data: Prisma.ClinicDoctorUncheckedCreateInput): Promise<ClinicDoctorWithRelations> {
    return prisma.clinicDoctor.create({ data, include: associationInclude });
  },

  update(id: string, data: Prisma.ClinicDoctorUpdateInput): Promise<ClinicDoctorWithRelations> {
    return prisma.clinicDoctor.update({ where: { id }, data, include: associationInclude });
  },

  remove(id: string) {
    return prisma.clinicDoctor.delete({ where: { id } });
  },
};
