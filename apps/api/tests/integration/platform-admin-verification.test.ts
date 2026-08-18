import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { UserRole } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPlatformAdminFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

async function setupSubmittedClinic() {
  const fixture = await createDoctorFixture(app);
  const clinicAdmin = await createReceptionFixture(app, fixture.clinicId, [], { role: UserRole.CLINIC_ADMIN });
  const submitRes = await request(app)
    .post('/api/v1/clinic/verification')
    .set('Authorization', `Bearer ${clinicAdmin.token}`)
    .send({ clinicId: fixture.clinicId, notes: 'All documents attached' });
  expect(submitRes.status).toBe(200);
  return { fixture, clinicAdmin };
}

describe('PATCH /api/v1/platform-admin/clinics/:id/verification', () => {
  it('drives a clinic through the full SUBMITTED -> UNDER_REVIEW -> VERIFIED lifecycle', async () => {
    const admin = await createPlatformAdminFixture(app);
    const { fixture, clinicAdmin } = await setupSubmittedClinic();

    const toReview = await request(app)
      .patch(`/api/v1/platform-admin/clinics/${fixture.clinicId}/verification`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'UNDER_REVIEW' });
    expect(toReview.status).toBe(200);
    expect(toReview.body.data.clinic.verificationStatus).toBe('UNDER_REVIEW');

    const toVerified = await request(app)
      .patch(`/api/v1/platform-admin/clinics/${fixture.clinicId}/verification`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'VERIFIED', notes: 'Documents check out' });
    expect(toVerified.status).toBe(200);
    expect(toVerified.body.data.clinic.verificationStatus).toBe('VERIFIED');
    expect(toVerified.body.data.clinic.verificationReviewNotes).toBe('Documents check out');
    expect(toVerified.body.data.clinic.verificationReviewedAt).not.toBeNull();

    const notif = await prisma.notification.findFirst({ where: { userId: clinicAdmin.userId, type: 'CLINIC_VERIFICATION_UPDATED' } });
    expect(notif).not.toBeNull();

    const auditRows = await prisma.auditLog.findMany({ where: { entityType: 'Clinic', entityId: fixture.clinicId, action: 'platform.clinic_verification_updated' } });
    expect(auditRows.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects an invalid transition — a clinic that never submitted cannot jump straight to VERIFIED', async () => {
    const admin = await createPlatformAdminFixture(app);
    const fixture = await createDoctorFixture(app);

    const res = await request(app)
      .patch(`/api/v1/platform-admin/clinics/${fixture.clinicId}/verification`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'VERIFIED' });
    expect(res.status).toBe(409);
  });

  it('requires a reason to reject or suspend a clinic', async () => {
    const admin = await createPlatformAdminFixture(app);
    const { fixture } = await setupSubmittedClinic();

    const res = await request(app)
      .patch(`/api/v1/platform-admin/clinics/${fixture.clinicId}/verification`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'REJECTED' });
    expect(res.status).toBe(400);
  });

  it('rejects with a reason, and the clinic admin is notified with that reason', async () => {
    const admin = await createPlatformAdminFixture(app);
    const { fixture, clinicAdmin } = await setupSubmittedClinic();

    const res = await request(app)
      .patch(`/api/v1/platform-admin/clinics/${fixture.clinicId}/verification`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'REJECTED', notes: 'Registration certificate is illegible' });
    expect(res.status).toBe(200);

    const notif = await prisma.notification.findFirst({ where: { userId: clinicAdmin.userId, type: 'CLINIC_VERIFICATION_UPDATED' } });
    expect(notif!.message).toContain('Registration certificate is illegible');
  });

  it('a rejected clinic can be reopened for review, and a verified clinic can be suspended and reinstated', async () => {
    const admin = await createPlatformAdminFixture(app);
    const { fixture } = await setupSubmittedClinic();
    await request(app).patch(`/api/v1/platform-admin/clinics/${fixture.clinicId}/verification`).set('Authorization', `Bearer ${admin.token}`).send({ status: 'REJECTED', notes: 'fix docs' });

    const reopen = await request(app).patch(`/api/v1/platform-admin/clinics/${fixture.clinicId}/verification`).set('Authorization', `Bearer ${admin.token}`).send({ status: 'UNDER_REVIEW' });
    expect(reopen.status).toBe(200);

    const verify = await request(app).patch(`/api/v1/platform-admin/clinics/${fixture.clinicId}/verification`).set('Authorization', `Bearer ${admin.token}`).send({ status: 'VERIFIED' });
    expect(verify.status).toBe(200);

    const suspend = await request(app).patch(`/api/v1/platform-admin/clinics/${fixture.clinicId}/verification`).set('Authorization', `Bearer ${admin.token}`).send({ status: 'SUSPENDED', notes: 'compliance issue' });
    expect(suspend.status).toBe(200);

    const reinstate = await request(app).patch(`/api/v1/platform-admin/clinics/${fixture.clinicId}/verification`).set('Authorization', `Bearer ${admin.token}`).send({ status: 'VERIFIED' });
    expect(reinstate.status).toBe(200);
  });

  it('a non-platform-admin cannot update verification status', async () => {
    const { fixture, clinicAdmin } = await setupSubmittedClinic();
    const res = await request(app)
      .patch(`/api/v1/platform-admin/clinics/${fixture.clinicId}/verification`)
      .set('Authorization', `Bearer ${clinicAdmin.token}`)
      .send({ status: 'VERIFIED' });
    expect(res.status).toBe(403);
  });

  it('returns 404 for a nonexistent clinic', async () => {
    const admin = await createPlatformAdminFixture(app);
    const res = await request(app)
      .patch('/api/v1/platform-admin/clinics/00000000-0000-0000-0000-000000000000/verification')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'UNDER_REVIEW' });
    expect(res.status).toBe(404);
  });
});

describe('MANDATORY: two concurrent verification decisions on the same clinic never corrupt the final state', () => {
  it('both individually-valid decisions succeed at the HTTP layer, but the row lands on exactly one consistent final status', async () => {
    const admin = await createPlatformAdminFixture(app);
    const { fixture } = await setupSubmittedClinic();
    await request(app).patch(`/api/v1/platform-admin/clinics/${fixture.clinicId}/verification`).set('Authorization', `Bearer ${admin.token}`).send({ status: 'UNDER_REVIEW' });

    const [a, b] = await Promise.all([
      request(app).patch(`/api/v1/platform-admin/clinics/${fixture.clinicId}/verification`).set('Authorization', `Bearer ${admin.token}`).send({ status: 'VERIFIED' }),
      request(app).patch(`/api/v1/platform-admin/clinics/${fixture.clinicId}/verification`).set('Authorization', `Bearer ${admin.token}`).send({ status: 'REJECTED', notes: 'race' }),
    ]);

    expect([a.status, b.status]).toEqual([200, 200]);

    const clinic = await prisma.clinic.findUniqueOrThrow({ where: { id: fixture.clinicId } });
    expect(['VERIFIED', 'REJECTED']).toContain(clinic.verificationStatus);
  });
});
