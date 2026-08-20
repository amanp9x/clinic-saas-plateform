import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { UserRole } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');
const { prisma } = await import('../../src/config/database.js');
const { processStaleInvitationExpiries } = await import('../../src/modules/notifications/reminder.service.js');

const app = createApp();

async function createClinicAndAdmin() {
  const clinic = await createDoctorFixture(app);
  const admin = await createReceptionFixture(app, clinic.clinicId, [], { role: UserRole.CLINIC_ADMIN });
  return { clinic, admin };
}

async function inviteAndBackdate(clinicId: string, adminToken: string, email: string) {
  const res = await request(app)
    .post('/api/v1/clinic/staff/invitations')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ clinicId, email, role: 'RECEPTIONIST', permissions: [] });
  expect(res.status).toBe(201);
  const invitation = await prisma.staffInvitation.findFirstOrThrow({ where: { clinicId, email } });
  await prisma.staffInvitation.update({ where: { id: invitation.id }, data: { expiresAt: new Date(Date.now() - 60_000) } });
  return invitation.id;
}

describe('Bug fix: a lapsed but unswept invitation no longer blocks re-inviting', () => {
  it('allows re-inviting the same email once the original invitation has silently gone stale', async () => {
    const { clinic, admin } = await createClinicAndAdmin();
    const email = `stale-${randomUUID().slice(0, 8)}@example.com`;
    await inviteAndBackdate(clinic.clinicId, admin.token, email);

    // Before the fix, this would 409 forever — the row is still `status: PENDING` in the DB even
    // though its link has already lapsed, and nothing had ever proactively swept it.
    const res = await request(app)
      .post('/api/v1/clinic/staff/invitations')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, email, role: 'RECEPTIONIST', permissions: [] });
    expect(res.status).toBe(201);
  });

  it('still rejects re-inviting while a genuinely live invitation exists', async () => {
    const { clinic, admin } = await createClinicAndAdmin();
    const email = `live-${randomUUID().slice(0, 8)}@example.com`;
    await request(app)
      .post('/api/v1/clinic/staff/invitations')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, email, role: 'RECEPTIONIST', permissions: [] });

    const res = await request(app)
      .post('/api/v1/clinic/staff/invitations')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, email, role: 'RECEPTIONIST', permissions: [] });
    expect(res.status).toBe(409);
  });
});

describe('processStaleInvitationExpiries', () => {
  it('expires a lapsed invitation, notifies the inviting admin, and records an audit log', async () => {
    const { clinic, admin } = await createClinicAndAdmin();
    const email = `sweep-${randomUUID().slice(0, 8)}@example.com`;
    const invitationId = await inviteAndBackdate(clinic.clinicId, admin.token, email);

    const result = await processStaleInvitationExpiries();
    expect(result.processed).toBeGreaterThanOrEqual(1);

    const updated = await prisma.staffInvitation.findUniqueOrThrow({ where: { id: invitationId } });
    expect(updated.status).toBe('EXPIRED');

    const notif = await prisma.notification.findUnique({ where: { notificationKey: `staff-invitation:${invitationId}:expired` } });
    expect(notif).not.toBeNull();
    expect(notif!.type).toBe('STAFF_INVITATION_EXPIRED');
    expect(notif!.userId).toBe(admin.userId);

    const audit = await prisma.auditLog.findFirst({ where: { entityType: 'StaffInvitation', entityId: invitationId, action: 'clinic.staff_invitation_expired' } });
    expect(audit).not.toBeNull();
  });

  it('never sends a duplicate notification when run twice for the same invitation', async () => {
    const { clinic, admin } = await createClinicAndAdmin();
    const email = `sweep-twice-${randomUUID().slice(0, 8)}@example.com`;
    const invitationId = await inviteAndBackdate(clinic.clinicId, admin.token, email);

    await processStaleInvitationExpiries();
    await processStaleInvitationExpiries();

    const count = await prisma.notification.count({ where: { notificationKey: `staff-invitation:${invitationId}:expired` } });
    expect(count).toBe(1);
  });

  it('does not touch an invitation that has not lapsed yet', async () => {
    const { clinic, admin } = await createClinicAndAdmin();
    const email = `not-yet-${randomUUID().slice(0, 8)}@example.com`;
    await request(app)
      .post('/api/v1/clinic/staff/invitations')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, email, role: 'RECEPTIONIST', permissions: [] });
    const invitation = await prisma.staffInvitation.findFirstOrThrow({ where: { clinicId: clinic.clinicId, email } });

    await processStaleInvitationExpiries();

    const unchanged = await prisma.staffInvitation.findUniqueOrThrow({ where: { id: invitation.id } });
    expect(unchanged.status).toBe('PENDING');
  });

  it('does not touch an already-revoked invitation', async () => {
    const { clinic, admin } = await createClinicAndAdmin();
    const email = `already-revoked-${randomUUID().slice(0, 8)}@example.com`;
    const invitationId = await inviteAndBackdate(clinic.clinicId, admin.token, email);
    await prisma.staffInvitation.update({ where: { id: invitationId }, data: { status: 'REVOKED' } });

    await processStaleInvitationExpiries();

    const stillRevoked = await prisma.staffInvitation.findUniqueOrThrow({ where: { id: invitationId } });
    expect(stillRevoked.status).toBe('REVOKED');
    const notif = await prisma.notification.findUnique({ where: { notificationKey: `staff-invitation:${invitationId}:expired` } });
    expect(notif).toBeNull();
  });
});

describe('MANDATORY: concurrent revoke and expiry sweep on the same invitation never both apply', () => {
  it('two concurrent processStaleInvitationExpiries ticks over the same stale batch produce exactly one notification each', async () => {
    const { clinic, admin } = await createClinicAndAdmin();
    const email = `concurrent-tick-${randomUUID().slice(0, 8)}@example.com`;
    const invitationId = await inviteAndBackdate(clinic.clinicId, admin.token, email);

    await Promise.all([processStaleInvitationExpiries(), processStaleInvitationExpiries()]);

    const count = await prisma.notification.count({ where: { notificationKey: `staff-invitation:${invitationId}:expired` } });
    expect(count).toBe(1);
    const updated = await prisma.staffInvitation.findUniqueOrThrow({ where: { id: invitationId } });
    expect(updated.status).toBe('EXPIRED');
  });

  it('an admin revoking at the same instant the sweep expires it: exactly one outcome wins, never both', async () => {
    const { clinic, admin } = await createClinicAndAdmin();
    const email = `race-${randomUUID().slice(0, 8)}@example.com`;
    const invitationId = await inviteAndBackdate(clinic.clinicId, admin.token, email);

    const [revokeRes, sweepResult] = await Promise.all([
      request(app).delete(`/api/v1/clinic/staff/invitations/${invitationId}?clinicId=${clinic.clinicId}`).set('Authorization', `Bearer ${admin.token}`),
      processStaleInvitationExpiries(),
    ]);

    const final = await prisma.staffInvitation.findUniqueOrThrow({ where: { id: invitationId } });
    expect(['REVOKED', 'EXPIRED']).toContain(final.status);

    const notif = await prisma.notification.findUnique({ where: { notificationKey: `staff-invitation:${invitationId}:expired` } });
    const auditExpired = await prisma.auditLog.findFirst({ where: { entityType: 'StaffInvitation', entityId: invitationId, action: 'clinic.staff_invitation_expired' } });

    if (final.status === 'EXPIRED') {
      // The sweep won the race — revoke must have lost and reported a conflict.
      expect(revokeRes.status).toBe(409);
      expect(sweepResult.processed).toBeGreaterThanOrEqual(1);
      expect(notif).not.toBeNull();
      expect(auditExpired).not.toBeNull();
    } else {
      // The revoke won the race — the sweep must have skipped this row entirely.
      expect(revokeRes.status).toBe(200);
      expect(notif).toBeNull();
      expect(auditExpired).toBeNull();
    }
  });
});
