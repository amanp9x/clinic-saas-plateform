import type { ClinicDocumentStatus, ClinicVerificationStatus, Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { EXPIRING_SOON_WINDOW_DAYS } from '../../utils/document-expiry.util.js';

const rowInclude = {
  _count: { select: { doctors: true } },
} satisfies Prisma.ClinicInclude;

const detailInclude = {
  _count: { select: { doctors: true, staff: true } },
} satisfies Prisma.ClinicInclude;

export type PlatformClinicRowWithRelations = Prisma.ClinicGetPayload<{ include: typeof rowInclude }>;
export type PlatformClinicDetailWithRelations = Prisma.ClinicGetPayload<{ include: typeof detailInclude }>;

const complianceRowInclude = {
  clinic: { select: { name: true } },
} satisfies Prisma.ClinicDocumentInclude;

export type ComplianceDocumentRowWithRelations = Prisma.ClinicDocumentGetPayload<{ include: typeof complianceRowInclude }>;

export const platformAdminRepository = {
  async overview() {
    const now = new Date();
    const expiringSoonWindowEnd = new Date(now.getTime() + EXPIRING_SOON_WINDOW_DAYS * 24 * 60 * 60_000);
    const [totalClinics, verificationGroups, totalDoctors, totalPatients, expiringDocumentsCount, expiredDocumentsCount] = await Promise.all([
      prisma.clinic.count(),
      prisma.clinic.groupBy({ by: ['verificationStatus'], _count: true }),
      prisma.doctor.count(),
      prisma.patient.count(),
      prisma.clinicDocument.count({ where: { expiryDate: { gte: now, lte: expiringSoonWindowEnd } } }),
      prisma.clinicDocument.count({ where: { expiryDate: { lt: now } } }),
    ]);
    return { totalClinics, verificationGroups, totalDoctors, totalPatients, expiringDocumentsCount, expiredDocumentsCount };
  },

  /** Phase 17 — Compliance & Renewal. Filters at the DB level (never loads every document with an
   * expiry and filters in memory) — `status` narrows to exactly one tier, omitted means "either
   * at-risk tier" (EXPIRED is a subset of "<= window end", so a single `lte` covers both). */
  async listComplianceDocuments(filters: { status?: 'EXPIRING_SOON' | 'EXPIRED'; page: number; limit: number }, now: Date = new Date()) {
    const expiringSoonWindowEnd = new Date(now.getTime() + EXPIRING_SOON_WINDOW_DAYS * 24 * 60 * 60_000);
    const where: Prisma.ClinicDocumentWhereInput =
      filters.status === 'EXPIRED'
        ? { expiryDate: { not: null, lt: now } }
        : filters.status === 'EXPIRING_SOON'
          ? { expiryDate: { gte: now, lte: expiringSoonWindowEnd } }
          : { expiryDate: { not: null, lte: expiringSoonWindowEnd } };

    const [items, total] = await Promise.all([
      prisma.clinicDocument.findMany({
        where,
        include: complianceRowInclude,
        orderBy: { expiryDate: 'asc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.clinicDocument.count({ where }),
    ]);
    return { items, total };
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
