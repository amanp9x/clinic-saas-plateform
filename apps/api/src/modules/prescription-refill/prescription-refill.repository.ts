import type { Prisma, RefillRequestStatus } from '@prisma/client';
import { prisma } from '../../config/database.js';

const detailInclude = {
  patient: true,
  doctor: true,
  prescription: { include: { items: { orderBy: { sortOrder: 'asc' } } } },
} satisfies Prisma.PrescriptionRefillRequestInclude;

export type RefillRequestWithRelations = Prisma.PrescriptionRefillRequestGetPayload<{ include: typeof detailInclude }>;

export const prescriptionRefillRepository = {
  findPrescriptionForPatient(id: string, patientId: string) {
    return prisma.prescription.findFirst({
      where: { id, patientId },
      include: { items: true },
    });
  },

  findPendingForPrescription(prescriptionId: string) {
    return prisma.prescriptionRefillRequest.findFirst({
      where: { prescriptionId, status: 'PENDING' },
    });
  },

  create(data: Prisma.PrescriptionRefillRequestUncheckedCreateInput) {
    return prisma.prescriptionRefillRequest.create({ data, include: detailInclude });
  },

  findByIdForPatient(id: string, patientId: string) {
    return prisma.prescriptionRefillRequest.findFirst({ where: { id, patientId }, include: detailInclude });
  },

  findByIdForDoctor(id: string, doctorId: string) {
    return prisma.prescriptionRefillRequest.findFirst({ where: { id, doctorId }, include: detailInclude });
  },

  async listForPatient(patientId: string, filters: { status?: RefillRequestStatus }, page: number, limit: number) {
    const where: Prisma.PrescriptionRefillRequestWhereInput = { patientId, ...filters };
    const [items, total] = await Promise.all([
      prisma.prescriptionRefillRequest.findMany({
        where,
        include: detailInclude,
        orderBy: { requestedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.prescriptionRefillRequest.count({ where }),
    ]);
    return { items, total };
  },

  async listForDoctor(doctorId: string, filters: { status?: RefillRequestStatus }, page: number, limit: number) {
    const where: Prisma.PrescriptionRefillRequestWhereInput = { doctorId, ...filters };
    const [items, total] = await Promise.all([
      prisma.prescriptionRefillRequest.findMany({
        where,
        include: detailInclude,
        orderBy: { requestedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.prescriptionRefillRequest.count({ where }),
    ]);
    return { items, total };
  },

  /** Atomic claim: only succeeds if the row is still PENDING at the moment of the update, so two
   * concurrent responses (e.g. approve + decline) to the same request can never both proceed —
   * exactly the updateMany-guard-and-count idiom used by doctor-queue's claimToken. */
  async claimForResponse(
    id: string,
    doctorId: string,
    data: { status: 'APPROVED' | 'DECLINED'; doctorNote: string | null; respondedByUserId: string },
  ): Promise<number> {
    const result = await prisma.prescriptionRefillRequest.updateMany({
      where: { id, doctorId, status: 'PENDING' },
      data: { status: data.status, doctorNote: data.doctorNote, respondedAt: new Date(), respondedByUserId: data.respondedByUserId },
    });
    return result.count;
  },

  setIssuedPrescription(id: string, issuedPrescriptionId: string) {
    return prisma.prescriptionRefillRequest.update({ where: { id }, data: { issuedPrescriptionId }, include: detailInclude });
  },

  findById(id: string) {
    return prisma.prescriptionRefillRequest.findUnique({ where: { id }, include: detailInclude });
  },
};
