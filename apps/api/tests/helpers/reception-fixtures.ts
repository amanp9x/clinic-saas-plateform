import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { Express } from 'express';
import { UserRole, type ClinicPermission } from '@clinic/shared';
import { prisma } from '../../src/config/database.js';
import { hashPassword } from '../../src/utils/password.js';

export const FRESH_RECEPTIONIST_PASSWORD = 'FreshRecep123!';

/**
 * Creates an isolated receptionist (ClinicStaffMember) at an already-existing clinic, with a
 * unique email per call, granted exactly `permissions` — so authorization tests can prove both
 * "has permission X" and "missing permission Y" paths without touching each other's state.
 * Defaults to CLINIC_STAFF role (mirrors RECEPTIONIST for authorization purposes) unless
 * `role: UserRole.CLINIC_ADMIN` is passed, which bypasses the individual permission-key check.
 */
export async function createReceptionFixture(
  app: Express,
  clinicId: string,
  permissions: ClinicPermission[],
  opts: { role?: UserRole } = {},
) {
  const suffix = randomUUID().slice(0, 8);
  const role = opts.role ?? UserRole.RECEPTIONIST;
  const passwordHash = await hashPassword(FRESH_RECEPTIONIST_PASSWORD);
  const email = `reception-fixture-${suffix}@example.com`;

  const user = await prisma.user.create({
    data: { email, passwordHash, role, isEmailVerified: true, isActive: true },
  });
  const staffMember = await prisma.clinicStaffMember.create({
    data: { userId: user.id, clinicId, title: 'Test Receptionist', permissions },
  });

  const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password: FRESH_RECEPTIONIST_PASSWORD });
  if (loginRes.status !== 200) {
    throw new Error(`Receptionist fixture login failed: ${JSON.stringify(loginRes.body)}`);
  }

  return {
    token: loginRes.body.data.accessToken as string,
    userId: user.id,
    clinicId,
    staffMemberId: staffMember.id,
  };
}
