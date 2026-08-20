import type { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../../config/database.js';

export const clinicStaffRepository = {
  async list(clinicId: string, q: string | undefined, role: UserRole | undefined, page: number, limit: number) {
    const where: Prisma.ClinicStaffMemberWhereInput = {
      clinicId,
      ...(role ? { user: { role } } : {}),
      ...(q ? { user: { OR: [{ email: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.clinicStaffMember.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.clinicStaffMember.count({ where }),
    ]);
    return { items, total };
  },

  findById(id: string, clinicId: string) {
    return prisma.clinicStaffMember.findFirst({ where: { id, clinicId }, include: { user: true } });
  },

  findByUserAndClinic(userId: string, clinicId: string) {
    return prisma.clinicStaffMember.findUnique({ where: { userId_clinicId: { userId, clinicId } } });
  },

  update(id: string, data: Prisma.ClinicStaffMemberUpdateInput) {
    return prisma.clinicStaffMember.update({ where: { id }, data, include: { user: true } });
  },

  remove(id: string) {
    return prisma.clinicStaffMember.delete({ where: { id } });
  },

  createStaffMember(data: Prisma.ClinicStaffMemberUncheckedCreateInput) {
    return prisma.clinicStaffMember.create({ data, include: { user: true } });
  },

  /** Only a *live* pending invitation blocks a re-invite — one whose 7-day link has already
   * lapsed is functionally dead even before the background sweep (see reminder.service.ts)
   * gets around to flipping its status, so it must never block sending a fresh one. */
  findPendingInvitation(clinicId: string, email: string) {
    return prisma.staffInvitation.findFirst({ where: { clinicId, email, status: 'PENDING', expiresAt: { gt: new Date() } } });
  },

  /** Every invitation that is still PENDING but whose link has already lapsed — the candidate
   * set for the background expiry sweep in reminder.service.ts. */
  findStaleInvitations(now: Date) {
    return prisma.staffInvitation.findMany({
      where: { status: 'PENDING', expiresAt: { lt: now } },
      select: { id: true, clinicId: true, email: true, invitedByUserId: true, clinic: { select: { name: true } }, invitedBy: { select: { email: true } } },
    });
  },

  /** Atomic claim: only succeeds if the row is still in the exact status the caller last read, so
   * an admin's manual revoke and the background expiry sweep can never both apply to the same
   * invitation — the same updateMany-guard-and-count idiom used by prescription-refill and
   * contact-message triage. */
  async claimInvitationTransition(id: string, expectedStatus: 'PENDING', status: 'REVOKED' | 'EXPIRED'): Promise<number> {
    const result = await prisma.staffInvitation.updateMany({ where: { id, status: expectedStatus }, data: { status } });
    return result.count;
  },

  createInvitation(data: Prisma.StaffInvitationUncheckedCreateInput) {
    return prisma.staffInvitation.create({ data, include: { invitedBy: true } });
  },

  listInvitations(clinicId: string) {
    return prisma.staffInvitation.findMany({ where: { clinicId }, include: { invitedBy: true }, orderBy: { createdAt: 'desc' } });
  },

  findInvitationById(id: string, clinicId: string) {
    return prisma.staffInvitation.findFirst({ where: { id, clinicId } });
  },

  findInvitationByToken(token: string) {
    return prisma.staffInvitation.findUnique({ where: { token } });
  },

  updateInvitation(id: string, data: Prisma.StaffInvitationUpdateInput) {
    return prisma.staffInvitation.update({ where: { id }, data });
  },
};
