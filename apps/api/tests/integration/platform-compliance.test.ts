import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { UserRole } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPlatformAdminFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');

const app = createApp();

function isoDateDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60_000).toISOString().slice(0, 10);
}

async function uploadDocument(token: string, clinicId: string, expiryDate?: string) {
  const req = request(app)
    .post('/api/v1/clinic/documents')
    .set('Authorization', `Bearer ${token}`)
    .field('clinicId', clinicId)
    .field('type', 'LICENSE');
  if (expiryDate) req.field('expiryDate', expiryDate);
  const res = await req.attach('file', Buffer.from('%PDF-1.4 fake license'), { filename: 'license.pdf', contentType: 'application/pdf' });
  expect(res.status).toBe(201);
  return res.body.data.document.id as string;
}

describe('GET /api/v1/platform-admin/compliance/documents', () => {
  it('lists expiring-soon and expired documents together by default, and never a VALID/NOT_TRACKED one', async () => {
    const admin = await createPlatformAdminFixture(app);
    const fixture = await createDoctorFixture(app);
    const clinicAdmin = await createReceptionFixture(app, fixture.clinicId, [], { role: UserRole.CLINIC_ADMIN });

    const expiredId = await uploadDocument(clinicAdmin.token, fixture.clinicId, isoDateDaysFromNow(-3));
    const soonId = await uploadDocument(clinicAdmin.token, fixture.clinicId, isoDateDaysFromNow(5));
    const validId = await uploadDocument(clinicAdmin.token, fixture.clinicId, isoDateDaysFromNow(300));
    const untrackedId = await uploadDocument(clinicAdmin.token, fixture.clinicId);

    const res = await request(app).get('/api/v1/platform-admin/compliance/documents').set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.items.map((d: { id: string }) => d.id);
    expect(ids).toContain(expiredId);
    expect(ids).toContain(soonId);
    expect(ids).not.toContain(validId);
    expect(ids).not.toContain(untrackedId);
  });

  it('filters to exactly one tier when status is given', async () => {
    const admin = await createPlatformAdminFixture(app);
    const fixture = await createDoctorFixture(app);
    const clinicAdmin = await createReceptionFixture(app, fixture.clinicId, [], { role: UserRole.CLINIC_ADMIN });
    const expiredId = await uploadDocument(clinicAdmin.token, fixture.clinicId, isoDateDaysFromNow(-1));
    const soonId = await uploadDocument(clinicAdmin.token, fixture.clinicId, isoDateDaysFromNow(2));

    const expiredOnly = await request(app).get('/api/v1/platform-admin/compliance/documents?status=EXPIRED').set('Authorization', `Bearer ${admin.token}`);
    const expiredIds = expiredOnly.body.data.items.map((d: { id: string }) => d.id);
    expect(expiredIds).toContain(expiredId);
    expect(expiredIds).not.toContain(soonId);

    const soonOnly = await request(app).get('/api/v1/platform-admin/compliance/documents?status=EXPIRING_SOON').set('Authorization', `Bearer ${admin.token}`);
    const soonIds = soonOnly.body.data.items.map((d: { id: string }) => d.id);
    expect(soonIds).toContain(soonId);
    expect(soonIds).not.toContain(expiredId);
  });

  it('rejects a patient and a doctor', async () => {
    const fixture = await createDoctorFixture(app);
    const res = await request(app).get('/api/v1/platform-admin/compliance/documents').set('Authorization', `Bearer ${fixture.token}`);
    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/platform-admin/compliance/documents');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/platform-admin/overview — compliance counts', () => {
  it('reflects newly-expiring and expired documents', async () => {
    const admin = await createPlatformAdminFixture(app);
    const fixture = await createDoctorFixture(app);
    const clinicAdmin = await createReceptionFixture(app, fixture.clinicId, [], { role: UserRole.CLINIC_ADMIN });

    const before = await request(app).get('/api/v1/platform-admin/overview').set('Authorization', `Bearer ${admin.token}`);
    const baselineExpiring = before.body.data.overview.expiringDocumentsCount as number;
    const baselineExpired = before.body.data.overview.expiredDocumentsCount as number;

    await uploadDocument(clinicAdmin.token, fixture.clinicId, isoDateDaysFromNow(3));
    await uploadDocument(clinicAdmin.token, fixture.clinicId, isoDateDaysFromNow(-2));

    const after = await request(app).get('/api/v1/platform-admin/overview').set('Authorization', `Bearer ${admin.token}`);
    expect(after.body.data.overview.expiringDocumentsCount).toBe(baselineExpiring + 1);
    expect(after.body.data.overview.expiredDocumentsCount).toBe(baselineExpired + 1);
  });
});
