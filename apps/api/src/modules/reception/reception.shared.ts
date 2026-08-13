import { UserRole, type ClinicPermission } from '@clinic/shared';
import { prisma } from '../../config/database.js';
import { ForbiddenError, NotFoundError } from '../../utils/app-error.js';

const PERMISSION_BYPASS_ROLES = new Set<UserRole>([UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN]);

/**
 * Guards every clinic-scoped reception action. Mirrors `doctor.shared.ts::assertClinicMembership`
 * exactly, but for staff instead of doctors: `SUPER_ADMIN`/`PLATFORM_ADMIN` bypass entirely;
 * `CLINIC_ADMIN` must be an active staff row at this clinic but bypasses the individual
 * permission-key check; `RECEPTIONIST`/`CLINIC_STAFF` must be an active staff row whose
 * `permissions` array includes the requested key. Never trust a client-supplied permission —
 * this is always re-derived server-side from the authenticated user's role + DB row.
 */
export async function assertClinicPermission(
  userId: string,
  role: UserRole,
  clinicId: string,
  permission: ClinicPermission,
) {
  if (PERMISSION_BYPASS_ROLES.has(role)) return null;

  const membership = await prisma.clinicStaffMember.findUnique({
    where: { userId_clinicId: { userId, clinicId } },
  });
  if (!membership || !membership.isActive) {
    throw new ForbiddenError('You are not associated with this clinic');
  }
  if (role === UserRole.CLINIC_ADMIN) return membership;
  if (!membership.permissions.includes(permission)) {
    throw new ForbiddenError(`Missing permission: ${permission}`);
  }
  return membership;
}

/** Resolves the acting staff member's full clinic list (for a clinic picker) — no permission
 * filtering, since "which clinics am I staff at" is not itself a gated action. */
export function listStaffClinics(userId: string) {
  return prisma.clinicStaffMember.findMany({
    where: { userId, isActive: true },
    include: { clinic: true },
    orderBy: { createdAt: 'asc' },
  });
}

/** Confirms the doctor selected in the reception UI is actually active at this clinic — reused
 * by every reception-queue/reception-checkin action that takes a `doctorId` from the client. */
export async function requireDoctorAtClinic(doctorId: string, clinicId: string) {
  const membership = await prisma.clinicDoctor.findUnique({
    where: { clinicId_doctorId: { clinicId, doctorId } },
    include: { doctor: { include: { user: true } }, clinic: true },
  });
  if (!membership || !membership.isActive) {
    throw new NotFoundError('Doctor at this clinic');
  }
  return membership;
}
