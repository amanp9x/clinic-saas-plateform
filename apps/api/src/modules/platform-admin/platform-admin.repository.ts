import type { ClinicDocumentStatus, ClinicVerificationStatus, Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';

const rowInclude = {
  _count: { select: { doctors: true } },
} satisfies Prisma.ClinicInclude;

const detailInclude = {
  _count: { select: { doctors: true, staff: true } },
} satisfies Prisma.ClinicInclude;

export type PlatformClinicRowWithRelations = Prisma.ClinicGetPayload<{ include: typeof rowInclude }>;
export type PlatformClinicDetailWithRelations = Prisma.ClinicGetPayload<{ include: typeof detailInclude }>;

export const platformAdminRepository = {
  async overview() {
    const [totalClinics, verificationGroups, totalDoctors, totalPatients] = await Promise.all([
      prisma.clinic.count(),
      prisma.clinic.groupBy({ by: ['verificationStatus'], _count: true }),
      prisma.doctor.count(),
      prisma.patient.count(),
    ]);
    return { totalClinics, verificationGroups, totalDoctors, totalPatients };
  },

  async listClinics(filters: { verificationStatus?: ClinicVerificationStatus; search?: string; page: number; limit: number }) {
    const where: Prisma.ClinicWhereInput = {
      verificationStatus: filters.verificationStatus,
      ...(filters.search
        ? { OR: [{ name: { contains: filters.search, mode: 'insensitive' } }, { city: { contains: filters.search, mode: 'insensitive' } }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.clinic.findMany({
        where,
        include: rowInclude,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.clinic.count({ where }),
    ]);
    return { items, total };
  },

  findClinicDetail(id: string) {
    return prisma.clinic.findUnique({ where: { id }, include: detailInclude });
  },

  updateVerification(
    id: string,
    data: { verificationStatus: ClinicVerificationStatus; verificationReviewNotes: string | null; verificationReviewedByUserId: string },
  ) {
    return prisma.clinic.update({
      where: { id },
      data: { ...data, verificationReviewedAt: new Date() },
      include: detailInclude,
    });
  },

  updateDocumentStatus(id: string, status: ClinicDocumentStatus) {
    return prisma.clinicDocument.update({ where: { id }, data: { status } });
  },

  /** Who to notify when this clinic's verification status changes — every active CLINIC_ADMIN
   * staff member, not just whoever originally submitted the application. */
  clinicAdminUserIds(clinicId: string) {
    return prisma.clinicStaffMember.findMany({
      where: { clinicId, isActive: true, user: { role: 'CLINIC_ADMIN' } },
      select: { userId: true },
    });
  },
};
