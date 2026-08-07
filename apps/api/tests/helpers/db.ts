import { UserRole } from '@prisma/client';
import { prisma } from '../../src/config/database.js';

/**
 * Wipes auth-test-created data between tests. FK-safe order: children before parents.
 * Scoped to PATIENT-role users only — catalog tests seed DOCTOR-role users whose Doctor/
 * ClinicDoctor/DoctorReview rows would cascade-delete if we wiped every user here.
 */
export async function resetAuthTables(): Promise<void> {
  await prisma.auditLog.deleteMany();
  await prisma.otpCode.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.user.deleteMany({ where: { role: UserRole.PATIENT } });
}
