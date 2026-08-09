import type { Prisma, PrescriptionStatus } from '@prisma/client';
import { prisma } from '../../config/database.js';

const detailInclude = {
  items: { orderBy: { sortOrder: 'asc' } },
  patient: true,
  doctor: true,
  appointment: { include: { clinic: true } },
} satisfies Prisma.PrescriptionInclude;

export type PrescriptionWithRelations = Prisma.PrescriptionGetPayload<{ include: typeof detailInclude }>;

export const prescriptionRepository = {
  async list(
    doctorId: string,
    filters: { patientId?: string; appointmentId?: string; status?: PrescriptionStatus },
    page: number,
    limit: number,
  ) {
    const where: Prisma.PrescriptionWhereInput = { doctorId, ...filters };
    const [items, total] = await Promise.all([
      prisma.prescription.findMany({
        where,
        include: detailInclude,
        orderBy: { issuedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.prescription.count({ where }),
    ]);
    return { items, total };
  },

  findById(id: string, doctorId: string) {
    return prisma.prescription.findFirst({ where: { id, doctorId }, include: detailInclude });
  },

  create(
    doctorId: string,
    data: Omit<Prisma.PrescriptionUncheckedCreateInput, 'doctorId' | 'medications' | 'items'>,
    items: Omit<Prisma.PrescriptionItemUncheckedCreateInput, 'prescriptionId'>[],
  ) {
    return prisma.prescription.create({
      data: {
        ...data,
        doctorId,
        medications: [],
        items: { create: items },
      },
      include: detailInclude,
    });
  },

  async update(
    id: string,
    data: Omit<Prisma.PrescriptionUncheckedUpdateInput, 'items'>,
    items?: Omit<Prisma.PrescriptionItemUncheckedCreateInput, 'prescriptionId'>[],
  ) {
    if (items) {
      await prisma.prescriptionItem.deleteMany({ where: { prescriptionId: id } });
    }
    return prisma.prescription.update({
      where: { id },
      data: {
        ...data,
        ...(items ? { items: { create: items } } : {}),
      },
      include: detailInclude,
    });
  },
};
