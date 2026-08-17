import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { CLINIC_PERMISSIONS, UserRole } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');

const app = createApp();

describe('GET /api/v1/analytics/overview — access control', () => {
  it('denies a patient outright', async () => {
    const patient = await createPatientFixture(app);
    const fixture = await createDoctorFixture(app);
    const res = await request(app)
      .get('/api/v1/analytics/overview')
      .query({ clinicId: fixture.clinicId, range: 'last7days' })
      .set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(403);
  });

  it('denies clinic staff without ANALYTICS_VIEW', async () => {
    const fixture = await createDoctorFixture(app);
    const staff = await createReceptionFixture(app, fixture.clinicId, []);
    const res = await request(app)
      .get('/api/v1/analytics/overview')
      .query({ clinicId: fixture.clinicId, range: 'last7days' })
      .set('Authorization', `Bearer ${staff.token}`);
    expect(res.status).toBe(403);
  });

  it('allows clinic staff with ANALYTICS_VIEW', async () => {
    const fixture = await createDoctorFixture(app);
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.ANALYTICS_VIEW]);
    const res = await request(app)
      .get('/api/v1/analytics/overview')
      .query({ clinicId: fixture.clinicId, range: 'last7days' })
      .set('Authorization', `Bearer ${staff.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.clinicId).toBe(fixture.clinicId);
  });

  it('allows CLINIC_ADMIN via the permission bypass without any explicit grant', async () => {
    const fixture = await createDoctorFixture(app);
    const admin = await createReceptionFixture(app, fixture.clinicId, [], { role: UserRole.CLINIC_ADMIN });
    const res = await request(app)
      .get('/api/v1/analytics/overview')
      .query({ clinicId: fixture.clinicId, range: 'last7days' })
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
  });

  it('denies staff of a foreign clinic (cross-clinic isolation)', async () => {
    const fixtureA = await createDoctorFixture(app);
    const fixtureB = await createDoctorFixture(app);
    const staffOfA = await createReceptionFixture(app, fixtureA.clinicId, [CLINIC_PERMISSIONS.ANALYTICS_VIEW]);
    const res = await request(app)
      .get('/api/v1/analytics/overview')
      .query({ clinicId: fixtureB.clinicId, range: 'last7days' })
      .set('Authorization', `Bearer ${staffOfA.token}`);
    expect(res.status).toBe(403);
  });

  it('rejects a nonexistent clinicId with 403 for a non-member — never confirms clinic existence to an outsider', async () => {
    const fixture = await createDoctorFixture(app);
    const admin = await createReceptionFixture(app, fixture.clinicId, [], { role: UserRole.CLINIC_ADMIN });
    const res = await request(app)
      .get('/api/v1/analytics/overview')
      .query({ clinicId: '00000000-0000-0000-0000-000000000000', range: 'last7days' })
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(403);
  });

  it('rejects a nonexistent clinicId with 404 for a platform role that bypasses per-clinic membership', async () => {
    const { prisma } = await import('../../src/config/database.js');
    const { hashPassword } = await import('../../src/utils/password.js');
    const email = `super-admin-fixture-${Date.now()}@example.com`;
    await prisma.user.create({ data: { email, passwordHash: await hashPassword('SuperAdmin123!'), role: UserRole.SUPER_ADMIN, isEmailVerified: true, isActive: true } });
    const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password: 'SuperAdmin123!' });
    expect(loginRes.status).toBe(200);

    const res = await request(app)
      .get('/api/v1/analytics/overview')
      .query({ clinicId: '00000000-0000-0000-0000-000000000000', range: 'last7days' })
      .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`);
    expect(res.status).toBe(404);
  });

  it('omits revenue figures for staff with ANALYTICS_VIEW but not ANALYTICS_REVENUE_VIEW, without denying the whole request', async () => {
    const fixture = await createDoctorFixture(app);
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.ANALYTICS_VIEW]);
    const res = await request(app)
      .get('/api/v1/analytics/overview')
      .query({ clinicId: fixture.clinicId, range: 'last7days' })
      .set('Authorization', `Bearer ${staff.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.revenue.grossCollected).toBe(0);
    expect(res.body.data.revenue.successfulPaymentCount).toBe(0);
  });
});

describe('GET /api/v1/analytics/revenue — separate revenue permission', () => {
  it('denies a caller who only has ANALYTICS_VIEW', async () => {
    const fixture = await createDoctorFixture(app);
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.ANALYTICS_VIEW]);
    const res = await request(app)
      .get('/api/v1/analytics/revenue')
      .query({ clinicId: fixture.clinicId, range: 'last7days' })
      .set('Authorization', `Bearer ${staff.token}`);
    expect(res.status).toBe(403);
  });

  it('allows a caller with ANALYTICS_REVENUE_VIEW', async () => {
    const fixture = await createDoctorFixture(app);
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.ANALYTICS_REVENUE_VIEW]);
    const res = await request(app)
      .get('/api/v1/analytics/revenue')
      .query({ clinicId: fixture.clinicId, range: 'last7days' })
      .set('Authorization', `Bearer ${staff.token}`);
    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/analytics/doctors — doctor self-scope isolation', () => {
  it('a doctor sees only their own performance row regardless of a requested doctorId', async () => {
    const fixtureA = await createDoctorFixture(app);
    const fixtureB = await createDoctorFixture(app);
    // Put doctor B at clinic A too, so both doctors are legitimately in clinic A's roster.
    const { prisma } = await import('../../src/config/database.js');
    await prisma.clinicDoctor.create({ data: { clinicId: fixtureA.clinicId, doctorId: fixtureB.doctorId } });

    const res = await request(app)
      .get('/api/v1/analytics/doctors')
      .query({ clinicId: fixtureA.clinicId, range: 'last30days', doctorId: fixtureB.doctorId })
      .set('Authorization', `Bearer ${fixtureA.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.rows).toHaveLength(1);
    expect(res.body.data.rows[0].doctorId).toBe(fixtureA.doctorId);
  });

  it('a doctor with no clinic membership is denied', async () => {
    const fixtureA = await createDoctorFixture(app);
    const fixtureB = await createDoctorFixture(app);
    const res = await request(app)
      .get('/api/v1/analytics/doctors')
      .query({ clinicId: fixtureA.clinicId, range: 'last30days' })
      .set('Authorization', `Bearer ${fixtureB.token}`);
    expect(res.status).toBe(403);
  });

  it('clinic staff see every active doctor at the clinic', async () => {
    const fixtureA = await createDoctorFixture(app);
    const fixtureB = await createDoctorFixture(app);
    const { prisma } = await import('../../src/config/database.js');
    await prisma.clinicDoctor.create({ data: { clinicId: fixtureA.clinicId, doctorId: fixtureB.doctorId } });
    const staff = await createReceptionFixture(app, fixtureA.clinicId, [CLINIC_PERMISSIONS.ANALYTICS_VIEW]);

    const res = await request(app)
      .get('/api/v1/analytics/doctors')
      .query({ clinicId: fixtureA.clinicId, range: 'last30days' })
      .set('Authorization', `Bearer ${staff.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.rows.length).toBeGreaterThanOrEqual(2);
  });
});

describe('GET /api/v1/analytics/export/:reportType — export authorization', () => {
  it('denies staff with ANALYTICS_VIEW but not ANALYTICS_EXPORT', async () => {
    const fixture = await createDoctorFixture(app);
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.ANALYTICS_VIEW]);
    const res = await request(app)
      .get('/api/v1/analytics/export/appointments')
      .query({ clinicId: fixture.clinicId, range: 'last7days' })
      .set('Authorization', `Bearer ${staff.token}`);
    expect(res.status).toBe(403);
  });

  it('allows staff with ANALYTICS_EXPORT', async () => {
    const fixture = await createDoctorFixture(app);
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.ANALYTICS_VIEW, CLINIC_PERMISSIONS.ANALYTICS_EXPORT]);
    const res = await request(app)
      .get('/api/v1/analytics/export/appointments')
      .query({ clinicId: fixture.clinicId, range: 'last7days' })
      .set('Authorization', `Bearer ${staff.token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
  });

  it('allows a doctor to export their own doctor-performance report with no clinic export grant', async () => {
    const fixture = await createDoctorFixture(app);
    const res = await request(app)
      .get('/api/v1/analytics/export/doctors')
      .query({ clinicId: fixture.clinicId, range: 'last7days' })
      .set('Authorization', `Bearer ${fixture.token}`);
    expect(res.status).toBe(200);
  });
});
