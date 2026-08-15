import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { UserRole } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture, FRESH_RECEPTIONIST_PASSWORD } = await import('../helpers/reception-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

let clinic: Awaited<ReturnType<typeof createDoctorFixture>>;
let admin: Awaited<ReturnType<typeof createReceptionFixture>>;

beforeAll(async () => {
  clinic = await createDoctorFixture(app);
  admin = await createReceptionFixture(app, clinic.clinicId, [], { role: UserRole.CLINIC_ADMIN });
});

describe('Staff list and management', () => {
  it('lists staff at the clinic', async () => {
    const res = await request(app).get(`/api/v1/clinic/staff?clinicId=${clinic.clinicId}`).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.staff.items.length).toBeGreaterThan(0);
  });

  it('updates a staff member permissions', async () => {
    const staffMember = await createReceptionFixture(app, clinic.clinicId, ['queue.view']);
    const listRes = await request(app).get(`/api/v1/clinic/staff?clinicId=${clinic.clinicId}`).set('Authorization', `Bearer ${admin.token}`);
    const entry = listRes.body.data.staff.items.find((s: { userId: string }) => s.userId === staffMember.userId);

    const res = await request(app)
      .patch(`/api/v1/clinic/staff/${entry.staffMemberId}/permissions?clinicId=${clinic.clinicId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ permissions: ['queue.view', 'queue.manage'] });
    expect(res.status).toBe(200);
    expect(res.body.data.staffMember.permissions).toEqual(['queue.view', 'queue.manage']);
  });

  it('deactivates and reactivates a staff member', async () => {
    const staffMember = await createReceptionFixture(app, clinic.clinicId, []);
    const listRes = await request(app).get(`/api/v1/clinic/staff?clinicId=${clinic.clinicId}`).set('Authorization', `Bearer ${admin.token}`);
    const entry = listRes.body.data.staff.items.find((s: { userId: string }) => s.userId === staffMember.userId);

    const deactivateRes = await request(app)
      .post(`/api/v1/clinic/staff/${entry.staffMemberId}/deactivate?clinicId=${clinic.clinicId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(deactivateRes.status).toBe(200);
    expect(deactivateRes.body.data.staffMember.isActive).toBe(false);

    const activateRes = await request(app)
      .post(`/api/v1/clinic/staff/${entry.staffMemberId}/activate?clinicId=${clinic.clinicId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(activateRes.status).toBe(200);
    expect(activateRes.body.data.staffMember.isActive).toBe(true);
  });

  it('revokes staff access entirely', async () => {
    const staffMember = await createReceptionFixture(app, clinic.clinicId, []);
    const listRes = await request(app).get(`/api/v1/clinic/staff?clinicId=${clinic.clinicId}`).set('Authorization', `Bearer ${admin.token}`);
    const entry = listRes.body.data.staff.items.find((s: { userId: string }) => s.userId === staffMember.userId);

    const res = await request(app).delete(`/api/v1/clinic/staff/${entry.staffMemberId}?clinicId=${clinic.clinicId}`).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);

    const afterRes = await request(app).get(`/api/v1/clinic/staff?clinicId=${clinic.clinicId}`).set('Authorization', `Bearer ${admin.token}`);
    expect(afterRes.body.data.staff.items.some((s: { staffMemberId: string }) => s.staffMemberId === entry.staffMemberId)).toBe(false);
  });
});

describe('Staff invitations', () => {
  it('invites a new staff member by email', async () => {
    const email = `invitee-${randomUUID().slice(0, 8)}@example.com`;
    const res = await request(app)
      .post('/api/v1/clinic/staff/invitations')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, email, role: 'RECEPTIONIST', title: 'Front Desk', permissions: ['queue.view'] });
    expect(res.status).toBe(201);
    expect(res.body.data.invitation.status).toBe('PENDING');
    expect(res.body.data.invitation).not.toHaveProperty('token');
  });

  it('rejects a duplicate active invitation for the same email', async () => {
    const email = `dup-${randomUUID().slice(0, 8)}@example.com`;
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

  it('accepts an invitation, creating a login-capable staff account, then revoking works only while pending', async () => {
    const email = `accept-${randomUUID().slice(0, 8)}@example.com`;
    await request(app)
      .post('/api/v1/clinic/staff/invitations')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, email, role: 'RECEPTIONIST', title: 'New Hire', permissions: ['queue.view'] });

    const invitation = await prisma.staffInvitation.findFirstOrThrow({ where: { clinicId: clinic.clinicId, email } });

    const acceptRes = await request(app)
      .post('/api/v1/clinic/staff/invitations/accept')
      .send({ token: invitation.token, fullName: 'New Hire Person', password: FRESH_RECEPTIONIST_PASSWORD });
    expect(acceptRes.status).toBe(201);
    expect(acceptRes.body.data.staffMember.fullName).toBe('New Hire Person');

    const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password: FRESH_RECEPTIONIST_PASSWORD });
    expect(loginRes.status).toBe(200);

    const secondAcceptRes = await request(app)
      .post('/api/v1/clinic/staff/invitations/accept')
      .send({ token: invitation.token, fullName: 'New Hire Person', password: FRESH_RECEPTIONIST_PASSWORD });
    expect(secondAcceptRes.status).toBe(409);
  });

  it('lists invitations and revokes a pending one', async () => {
    const email = `revoke-${randomUUID().slice(0, 8)}@example.com`;
    await request(app)
      .post('/api/v1/clinic/staff/invitations')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, email, role: 'CLINIC_STAFF', permissions: [] });

    const listRes = await request(app).get(`/api/v1/clinic/staff/invitations?clinicId=${clinic.clinicId}`).set('Authorization', `Bearer ${admin.token}`);
    const invitation = listRes.body.data.invitations.find((i: { email: string }) => i.email === email);
    expect(invitation).toBeDefined();

    const revokeRes = await request(app)
      .delete(`/api/v1/clinic/staff/invitations/${invitation.id}?clinicId=${clinic.clinicId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.data.invitation.status).toBe('REVOKED');
  });
});
