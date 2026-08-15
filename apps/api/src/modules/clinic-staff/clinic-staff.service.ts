import { randomBytes } from 'node:crypto';
import { CLINIC_PERMISSIONS, SOCKET_EVENTS, UserRole as SharedUserRole, type UserRole } from '@clinic/shared';
import type {
  StaffInviteAcceptInput,
  StaffInviteInput,
  StaffPermissionsUpdateInput,
  StaffRoleUpdateInput,
} from '@clinic/shared';
import { UserRole as PrismaUserRole } from '@prisma/client';
import { clinicStaffRepository } from './clinic-staff.repository.js';
import { toClinicStaffSummary, toStaffInvitationDto } from './clinic-staff.mappers.js';
import { assertClinicPermission } from '../reception/reception.shared.js';
import { prisma } from '../../config/database.js';
import { hashPassword } from '../../utils/password.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';
import { emitToClinicRoom } from '../../sockets/emit.js';
import { sendEmail } from '../../services/mailer.service.js';
import { env } from '../../config/env.js';

const INVITATION_TTL_DAYS = 7;
const STAFF_ROLES = new Set<UserRole>([SharedUserRole.RECEPTIONIST, SharedUserRole.CLINIC_STAFF, SharedUserRole.CLINIC_ADMIN]);

async function requireStaffMember(id: string, clinicId: string) {
  const member = await clinicStaffRepository.findById(id, clinicId);
  if (!member) throw new NotFoundError('Staff member');
  return member;
}

export const clinicStaffService = {
  async list(userId: string, role: UserRole, clinicId: string, q: string | undefined, staffRole: UserRole | undefined, page: number, limit: number) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.STAFF_VIEW);
    const { items, total } = await clinicStaffRepository.list(clinicId, q, staffRole as PrismaUserRole | undefined, page, limit);
    return {
      items: items.map(toClinicStaffSummary),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  },

  async getById(userId: string, role: UserRole, clinicId: string, staffMemberId: string) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.STAFF_VIEW);
    const member = await requireStaffMember(staffMemberId, clinicId);
    return toClinicStaffSummary(member);
  },

  async updateRole(userId: string, role: UserRole, clinicId: string, staffMemberId: string, input: StaffRoleUpdateInput) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.STAFF_MANAGE);
    const member = await requireStaffMember(staffMemberId, clinicId);

    // NOTE: `role` lives on User (a platform-wide account attribute, per the existing RBAC
    // model — see authorize() middleware) — not per-clinic. Changing it here affects every
    // clinic this person is staff at. This mirrors the existing architecture rather than
    // introducing a new per-clinic role concept.
    await prisma.user.update({ where: { id: member.userId }, data: { role: input.role as PrismaUserRole } });
    const updated = await clinicStaffRepository.update(staffMemberId, { title: input.title });

    recordAuditLog({ actorUserId: userId, action: 'clinic.staff_role_updated', entityType: 'ClinicStaffMember', entityId: staffMemberId, clinicId, metadata: { previousState: { role: member.user.role }, newState: { role: input.role } } });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.STAFF.UPDATED, { clinicId, staffMemberId });
    return toClinicStaffSummary(updated);
  },

  async updatePermissions(userId: string, role: UserRole, clinicId: string, staffMemberId: string, input: StaffPermissionsUpdateInput) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.STAFF_PERMISSIONS_MANAGE);
    const member = await requireStaffMember(staffMemberId, clinicId);

    const updated = await clinicStaffRepository.update(staffMemberId, { permissions: input.permissions });

    recordAuditLog({ actorUserId: userId, action: 'clinic.staff_permissions_updated', entityType: 'ClinicStaffMember', entityId: staffMemberId, clinicId, metadata: { previousState: { permissions: member.permissions }, newState: { permissions: input.permissions } } });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.STAFF.UPDATED, { clinicId, staffMemberId });
    return toClinicStaffSummary(updated);
  },

  async updateStatus(userId: string, role: UserRole, clinicId: string, staffMemberId: string, isActive: boolean) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.STAFF_MANAGE);
    await requireStaffMember(staffMemberId, clinicId);

    const updated = await clinicStaffRepository.update(staffMemberId, { isActive });

    recordAuditLog({ actorUserId: userId, action: isActive ? 'clinic.staff_activated' : 'clinic.staff_deactivated', entityType: 'ClinicStaffMember', entityId: staffMemberId, clinicId });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.STAFF.UPDATED, { clinicId, staffMemberId });
    return toClinicStaffSummary(updated);
  },

  async revoke(userId: string, role: UserRole, clinicId: string, staffMemberId: string) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.STAFF_MANAGE);
    const member = await requireStaffMember(staffMemberId, clinicId);

    await clinicStaffRepository.remove(staffMemberId);

    recordAuditLog({ actorUserId: userId, action: 'clinic.staff_access_revoked', entityType: 'ClinicStaffMember', entityId: staffMemberId, clinicId, metadata: { userId: member.userId } });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.STAFF.UPDATED, { clinicId, staffMemberId });
  },

  async invite(userId: string, role: UserRole, clinicId: string, input: StaffInviteInput) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.STAFF_MANAGE);
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) throw new NotFoundError('Clinic');

    const existingInvite = await clinicStaffRepository.findPendingInvitation(clinicId, input.email);
    if (existingInvite) throw new ConflictError('An active invitation already exists for this email');

    const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
    if (existingUser) {
      const existingMembership = await clinicStaffRepository.findByUserAndClinic(existingUser.id, clinicId);
      if (existingMembership) throw new ConflictError('This person is already a staff member at this clinic');
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

    const invitation = await clinicStaffRepository.createInvitation({
      clinicId,
      email: input.email,
      role: input.role,
      title: input.title,
      permissions: input.permissions,
      token,
      invitedByUserId: userId,
      expiresAt,
    });

    const acceptUrl = `${env.WEB_URL}/staff-invite/accept?token=${token}`;
    await sendEmail({
      to: input.email,
      subject: `You're invited to join ${clinic.name} on the clinic platform`,
      html: `<p>You've been invited to join <strong>${clinic.name}</strong> as ${input.role}.</p><p><a href="${acceptUrl}">Accept invitation</a> (expires in ${INVITATION_TTL_DAYS} days).</p>`,
      text: `You've been invited to join ${clinic.name} as ${input.role}. Accept: ${acceptUrl} (expires in ${INVITATION_TTL_DAYS} days).`,
    });

    recordAuditLog({ actorUserId: userId, action: 'clinic.staff_invited', entityType: 'StaffInvitation', entityId: invitation.id, clinicId, metadata: { email: input.email, role: input.role } });
    return toStaffInvitationDto(invitation);
  },

  async listInvitations(userId: string, role: UserRole, clinicId: string) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.STAFF_VIEW);
    const invitations = await clinicStaffRepository.listInvitations(clinicId);
    return invitations.map(toStaffInvitationDto);
  },

  async revokeInvitation(userId: string, role: UserRole, clinicId: string, invitationId: string) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.STAFF_MANAGE);
    const invitation = await clinicStaffRepository.findInvitationById(invitationId, clinicId);
    if (!invitation) throw new NotFoundError('Invitation');
    if (invitation.status !== 'PENDING') throw new ConflictError(`An invitation with status ${invitation.status} cannot be revoked`);

    const updated = await clinicStaffRepository.updateInvitation(invitationId, { status: 'REVOKED' });
    recordAuditLog({ actorUserId: userId, action: 'clinic.staff_invitation_revoked', entityType: 'StaffInvitation', entityId: invitationId, clinicId, metadata: { email: invitation.email } });
    return toStaffInvitationDto({ ...updated, invitedBy: await prisma.user.findUniqueOrThrow({ where: { id: updated.invitedByUserId } }) });
  },

  /** Public — no authenticated session exists yet. Links an existing account by email instead
   * of creating a duplicate, matching the walk-in-patient no-duplicate-account principle. */
  async acceptInvitation(input: StaffInviteAcceptInput) {
    const invitation = await clinicStaffRepository.findInvitationByToken(input.token);
    if (!invitation) throw new NotFoundError('Invitation');
    if (invitation.status !== 'PENDING') throw new ConflictError(`This invitation is ${invitation.status.toLowerCase()}`);
    if (invitation.expiresAt < new Date()) {
      await clinicStaffRepository.updateInvitation(invitation.id, { status: 'EXPIRED' });
      throw new ConflictError('This invitation has expired');
    }

    let user = await prisma.user.findUnique({ where: { email: invitation.email } });
    if (user) {
      if (!STAFF_ROLES.has(user.role)) {
        throw new ForbiddenError('This email is already registered under a different account type');
      }
    } else {
      const passwordHash = await hashPassword(input.password);
      user = await prisma.user.create({
        data: { email: invitation.email, passwordHash, role: invitation.role, isEmailVerified: true, isActive: true },
      });
    }

    const existingMembership = await clinicStaffRepository.findByUserAndClinic(user.id, invitation.clinicId);
    if (existingMembership) throw new ConflictError('This person is already a staff member at this clinic');

    const member = await clinicStaffRepository.createStaffMember({
      userId: user.id,
      clinicId: invitation.clinicId,
      fullName: input.fullName,
      title: invitation.title,
      permissions: invitation.permissions,
    });
    await clinicStaffRepository.updateInvitation(invitation.id, { status: 'ACCEPTED', acceptedAt: new Date() });

    recordAuditLog({ actorUserId: user.id, action: 'clinic.staff_invitation_accepted', entityType: 'ClinicStaffMember', entityId: member.id, clinicId: invitation.clinicId, metadata: { email: invitation.email } });
    emitToClinicRoom(invitation.clinicId, SOCKET_EVENTS.STAFF.UPDATED, { clinicId: invitation.clinicId });

    return toClinicStaffSummary(member);
  },
};
