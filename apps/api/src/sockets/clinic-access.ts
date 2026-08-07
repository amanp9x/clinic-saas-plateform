import { UserRole } from '@clinic/shared';
import { prisma } from '../config/database.js';

/**
 * Authorization gate for joining a clinic's real-time room. Staff/doctor roles are
 * checked against their actual clinic membership. Patients are allowed broadly for
 * now since appointment-level scoping requires the appointments module (later phase).
 */
export async function isUserAuthorizedForClinic(
  user: { id: string; role: UserRole },
  clinicId: string,
): Promise<boolean> {
  switch (user.role) {
    case UserRole.SUPER_ADMIN:
    case UserRole.PLATFORM_ADMIN:
      return true;

    case UserRole.CLINIC_ADMIN:
    case UserRole.CLINIC_STAFF:
    case UserRole.RECEPTIONIST: {
      const membership = await prisma.clinicStaffMember.findFirst({
        where: { userId: user.id, clinicId, isActive: true },
        select: { id: true },
      });
      return Boolean(membership);
    }

    case UserRole.DOCTOR: {
      const doctor = await prisma.doctor.findUnique({
        where: { userId: user.id },
        select: {
          clinics: { where: { clinicId, isActive: true }, select: { id: true }, take: 1 },
        },
      });
      return Boolean(doctor?.clinics.length);
    }

    case UserRole.PATIENT:
      return true;

    default:
      return false;
  }
}

export function clinicRoom(clinicId: string): string {
  return `clinic:${clinicId}`;
}
