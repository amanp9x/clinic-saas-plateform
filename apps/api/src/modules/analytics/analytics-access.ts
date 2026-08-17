import { UserRole, type ClinicPermission } from '@clinic/shared';
import { CLINIC_PERMISSIONS } from '@clinic/shared';
import { prisma } from '../../config/database.js';
import { ForbiddenError, NotFoundError } from '../../utils/app-error.js';
import { assertClinicPermission, listStaffClinics } from '../reception/reception.shared.js';
import { resolveDoctorOrThrow } from '../doctor/doctor.shared.js';

/** Every analytics/report endpoint funnels through here first. Patients are denied outright — no
 * patient-facing route ever mounts this module's controller. Doctors never reach this function for
 * clinic-wide analytics; they get their own scope via `assertDoctorOwnScope` below instead. */
export async function assertClinicAnalyticsAccess(
  userId: string,
  role: UserRole,
  clinicId: string,
  permission: ClinicPermission = CLINIC_PERMISSIONS.ANALYTICS_VIEW,
) {
  if (role === UserRole.PATIENT) {
    throw new ForbiddenError('Patients do not have access to clinic analytics');
  }
  // A DOCTOR reaching this function (clinic-wide analytics, not their own-scope view) must also
  // hold an explicit ClinicStaffMember grant (e.g. a doctor who is also a clinic admin) — being a
  // treating doctor at the clinic alone only grants the own-scope view via `assertDoctorOwnScope`.
  return assertClinicPermission(userId, role, clinicId, permission);
}

/** Resolves the doctor row for the authenticated DOCTOR user and confirms they belong to the
 * requested clinic — mirrors `assertClinicMembership` used throughout the doctor portal. Returns
 * the doctor's own id; callers must force every filter to this id, never trust a client-supplied
 * doctorId for a DOCTOR-role caller. */
export async function assertDoctorOwnScope(userId: string, clinicId: string): Promise<string> {
  const doctor = await resolveDoctorOrThrow(userId);
  const membership = await prisma.clinicDoctor.findUnique({ where: { clinicId_doctorId: { clinicId, doctorId: doctor.id } } });
  if (!membership || !membership.isActive) {
    throw new ForbiddenError('You are not associated with this clinic');
  }
  return doctor.id;
}

/** Returns every clinicId the caller is authorized to view analytics for — used by clinic
 * comparison (spec section 16). Never accepts clinicIds from the client without intersecting them
 * against this server-derived set first. */
export async function resolveAccessibleClinicIds(userId: string, role: UserRole, permission: ClinicPermission = CLINIC_PERMISSIONS.ANALYTICS_VIEW): Promise<string[]> {
  if (role === UserRole.SUPER_ADMIN || role === UserRole.PLATFORM_ADMIN) {
    const clinics = await prisma.clinic.findMany({ where: { deletedAt: null }, select: { id: true } });
    return clinics.map((c) => c.id);
  }
  const memberships = await listStaffClinics(userId);
  const accessible: string[] = [];
  for (const m of memberships) {
    if (role === UserRole.CLINIC_ADMIN || m.permissions.includes(permission)) {
      accessible.push(m.clinicId);
    }
  }
  return accessible;
}

export async function assertClinicExists(clinicId: string) {
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
  if (!clinic || clinic.deletedAt) throw new NotFoundError('Clinic');
  return clinic;
}
