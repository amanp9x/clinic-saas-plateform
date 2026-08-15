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

  findPendingInvitation(clinicId: string, email: string) {
    return prisma.staffInvitation.findFirst({ where: { clinicId, email, status: 'PENDING' } });
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
