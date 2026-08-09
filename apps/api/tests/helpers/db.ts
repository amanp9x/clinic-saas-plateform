import { UserRole } from '@prisma/client';
import { prisma } from '../../src/config/database.js';
import { DEMO_PATIENT_EMAIL } from '../../prisma/seed-constants.js';

/**
 * Wipes auth-test-created data between tests. FK-safe order: children before parents.
 * Scoped to PATIENT-role users, excluding the seeded demo patient — catalog/patient-portal
 * tests rely on that account (and DOCTOR-role users) surviving auth test resets.
 *
 * Filters by the demo user's `id`, not `email` — a naive `email: { not: DEMO_PATIENT_EMAIL }`
 * silently excludes phone-only OTP-created rows too, since SQL's `<>` never matches NULL.
 */
export async function resetAuthTables(): Promise<void> {
  await prisma.auditLog.deleteMany();
  await prisma.otpCode.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.session.deleteMany();

  const demoUser = await prisma.user.findUnique({
    where: { email: DEMO_PATIENT_EMAIL },
    select: { id: true },
  });
  const idFilter = demoUser ? { not: demoUser.id } : undefined;

  await prisma.patient.deleteMany({ where: idFilter ? { userId: idFilter } : undefined });
  await prisma.user.deleteMany({ where: { role: UserRole.PATIENT, ...(idFilter ? { id: idFilter } : {}) } });
}
