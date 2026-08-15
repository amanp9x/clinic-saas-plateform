import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ALL_CLINIC_PERMISSIONS, UserRole } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');

const app = createApp();

let clinicA: Awaited<ReturnType<typeof createDoctorFixture>>;
let clinicB: Awaited<ReturnType<typeof createDoctorFixture>>;
let adminA: Awaited<ReturnType<typeof createReceptionFixture>>;
let adminB: Awaited<ReturnType<typeof createReceptionFixture>>;
let staffNoPermA: Awaited<ReturnType<typeof createReceptionFixture>>;

beforeAll(async () => {
  clinicA = await createDoctorFixture(app);
  clinicB = await createDoctorFixture(app);
  adminA = await createReceptionFixture(app, clinicA.clinicId, [], { role: UserRole.CLINIC_ADMIN });
  adminB = await createReceptionFixture(app, clinicB.clinicId, [], { role: UserRole.CLINIC_ADMIN });
  staffNoPermA = await createReceptionFixture(app, clinicA.clinicId, []);
});

describe('Clinic Management authorization', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get(`/api/v1/clinic/dashboard?clinicId=${clinicA.clinicId}`);
    expect(res.status).toBe(401);
  });

  it('rejects a DOCTOR-role token', async () => {
    const res = await request(app).get(`/api/v1/clinic/dashboard?clinicId=${clinicA.clinicId}`).set('Authorization', `Bearer ${clinicA.token}`);
    expect(res.status).toBe(403);
  });

  it('allows a CLINIC_ADMIN to view the dashboard for their clinic', async () => {
    const res = await request(app).get(`/api/v1/clinic/dashboard?clinicId=${clinicA.clinicId}`).set('Authorization', `Bearer ${adminA.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.summary.clinicId).toBe(clinicA.clinicId);
  });

  it('rejects a staff member missing a specific clinic permission', async () => {
    const res = await request(app).get(`/api/v1/clinic/staff?clinicId=${clinicA.clinicId}`).set('Authorization', `Bearer ${staffNoPermA.token}`);
    expect(res.status).toBe(403);
  });

  it('allows a staff member granted the specific permission', async () => {
    const staffWithPerm = await createReceptionFixture(app, clinicA.clinicId, ALL_CLINIC_PERMISSIONS);
    const res = await request(app).get(`/api/v1/clinic/staff?clinicId=${clinicA.clinicId}`).set('Authorization', `Bearer ${staffWithPerm.token}`);
    expect(res.status).toBe(200);
  });
});

describe('Mandatory multi-tenant isolation', () => {
  it('Clinic A admin attempting to access Clinic B doctors fails securely', async () => {
    const res = await request(app).get(`/api/v1/clinic/doctors?clinicId=${clinicB.clinicId}`).set('Authorization', `Bearer ${adminA.token}`);
    expect(res.status).toBe(403);
  });

  it('Clinic A admin attempting to access Clinic B staff fails securely', async () => {
    const res = await request(app).get(`/api/v1/clinic/staff?clinicId=${clinicB.clinicId}`).set('Authorization', `Bearer ${adminA.token}`);
    expect(res.status).toBe(403);
  });

  it('Clinic A admin attempting to access Clinic B audit logs fails securely', async () => {
    const res = await request(app).get(`/api/v1/clinic/audit-logs?clinicId=${clinicB.clinicId}`).set('Authorization', `Bearer ${adminA.token}`);
    expect(res.status).toBe(403);
  });

  it('Clinic A admin attempting to access Clinic B documents fails securely', async () => {
    const res = await request(app).get(`/api/v1/clinic/documents?clinicId=${clinicB.clinicId}`).set('Authorization', `Bearer ${adminA.token}`);
    expect(res.status).toBe(403);
  });

  it('Clinic A admin cannot download a Clinic B document even with a valid document id', async () => {
    const uploadRes = await request(app)
      .post('/api/v1/clinic/documents')
      .set('Authorization', `Bearer ${adminB.token}`)
      .field('clinicId', clinicB.clinicId)
      .field('type', 'LICENSE')
      .attach('file', Buffer.from('%PDF-1.4 fake'), { filename: 'license.pdf', contentType: 'application/pdf' });
    expect(uploadRes.status).toBe(201);
    const documentId = uploadRes.body.data.document.id;

    // 404, not 403: adminA is legitimately permitted at clinic A (their own clinicId query
    // param passes the permission check), but the document lookup is scoped to clinic A and
    // simply finds nothing — the same "404 not 403" pattern used for cross-boundary access
    // elsewhere in this codebase (see doctor-patients.test.ts), which avoids confirming
    // whether a given document id exists at all under another clinic.
    const res = await request(app)
      .get(`/api/v1/clinic/documents/${documentId}/download?clinicId=${clinicA.clinicId}`)
      .set('Authorization', `Bearer ${adminA.token}`);
    expect(res.status).toBe(404);
  });

  it('Clinic A admin cannot associate a doctor at Clinic B by manipulating clinicId', async () => {
    const res = await request(app)
      .post('/api/v1/clinic/doctors')
      .set('Authorization', `Bearer ${adminA.token}`)
      .send({ clinicId: clinicB.clinicId, doctorId: clinicB.doctorId, consultationTypes: ['IN_CLINIC'] });
    expect(res.status).toBe(403);
  });
});
