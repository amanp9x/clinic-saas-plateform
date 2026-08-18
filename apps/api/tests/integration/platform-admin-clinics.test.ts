import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { UserRole } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createPlatformAdminFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');

const app = createApp();

describe('GET /api/v1/platform-admin/overview', () => {
  it('a SUPER_ADMIN can view the platform overview', async () => {
    const admin = await createPlatformAdminFixture(app, UserRole.SUPER_ADMIN);
    const res = await request(app).get('/api/v1/platform-admin/overview').set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.data.overview.totalClinics).toBe('number');
    expect(Array.isArray(res.body.data.overview.verificationBreakdown)).toBe(true);
  });

  it('a PLATFORM_ADMIN can view the platform overview too', async () => {
    const admin = await createPlatformAdminFixture(app, UserRole.PLATFORM_ADMIN);
    const res = await request(app).get('/api/v1/platform-admin/overview').set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
  });

  it('rejects a clinic admin, doctor, and patient', async () => {
    const fixture = await createDoctorFixture(app);
    const clinicAdmin = await createReceptionFixture(app, fixture.clinicId, [], { role: UserRole.CLINIC_ADMIN });
    const patient = await createPatientFixture(app);

    for (const token of [clinicAdmin.token, fixture.token, patient.token]) {
      const res = await request(app).get('/api/v1/platform-admin/overview').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    }
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/platform-admin/overview');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/platform-admin/clinics', () => {
  it('lists clinics and filters by verification status', async () => {
    const admin = await createPlatformAdminFixture(app);
    const fixture = await createDoctorFixture(app);

    const all = await request(app).get('/api/v1/platform-admin/clinics').set('Authorization', `Bearer ${admin.token}`);
    expect(all.status).toBe(200);
    expect(all.body.data.items.some((c: { id: string }) => c.id === fixture.clinicId)).toBe(true);

    const pending = await request(app).get('/api/v1/platform-admin/clinics?verificationStatus=PENDING').set('Authorization', `Bearer ${admin.token}`);
    expect(pending.status).toBe(200);
    expect(pending.body.data.items.every((c: { verificationStatus: string }) => c.verificationStatus === 'PENDING')).toBe(true);

    const verified = await request(app).get('/api/v1/platform-admin/clinics?verificationStatus=VERIFIED').set('Authorization', `Bearer ${admin.token}`);
    expect(verified.body.data.items.some((c: { id: string }) => c.id === fixture.clinicId)).toBe(false);
  });

  it('a non-platform-admin role cannot list clinics', async () => {
    const fixture = await createDoctorFixture(app);
    const res = await request(app).get('/api/v1/platform-admin/clinics').set('Authorization', `Bearer ${fixture.token}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/platform-admin/clinics/:id', () => {
  it('returns full clinic detail including documents and staff/doctor counts', async () => {
    const admin = await createPlatformAdminFixture(app);
    const fixture = await createDoctorFixture(app);

    const res = await request(app).get(`/api/v1/platform-admin/clinics/${fixture.clinicId}`).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.clinic.id).toBe(fixture.clinicId);
    expect(res.body.data.clinic.doctorCount).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.data.clinic.documents)).toBe(true);
  });

  it('returns 404 for a nonexistent clinic', async () => {
    const admin = await createPlatformAdminFixture(app);
    const res = await request(app).get('/api/v1/platform-admin/clinics/00000000-0000-0000-0000-000000000000').set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(404);
  });
});
