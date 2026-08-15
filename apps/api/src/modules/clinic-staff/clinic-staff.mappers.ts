import type { ClinicStaffMember, StaffInvitation, User } from '@prisma/client';
import type { ClinicStaffSummaryDto, StaffInvitationDto } from '@clinic/shared';

export function toClinicStaffSummary(member: ClinicStaffMember & { user: User }): ClinicStaffSummaryDto {
  return {
    staffMemberId: member.id,
    userId: member.userId,
    fullName: member.fullName,
    email: member.user.email,
    phone: member.user.phone,
    role: member.user.role,
    title: member.title,
    permissions: member.permissions,
    isActive: member.isActive,
    joinedAt: member.createdAt.toISOString(),
    lastActiveAt: member.user.lastLoginAt ? member.user.lastLoginAt.toISOString() : null,
  };
}

export function toStaffInvitationDto(invitation: StaffInvitation & { invitedBy: User }): StaffInvitationDto {
  return {
    id: invitation.id,
    clinicId: invitation.clinicId,
    email: invitation.email,
    role: invitation.role,
    title: invitation.title,
    permissions: invitation.permissions,
    status: invitation.status,
    invitedByName: invitation.invitedBy.email ?? invitation.invitedBy.phone,
    expiresAt: invitation.expiresAt.toISOString(),
    acceptedAt: invitation.acceptedAt ? invitation.acceptedAt.toISOString() : null,
    createdAt: invitation.createdAt.toISOString(),
  };
}
