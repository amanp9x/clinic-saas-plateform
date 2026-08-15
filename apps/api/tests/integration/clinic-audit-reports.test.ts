import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { UserRole } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');

const app = createApp();

let clinic: Awaited<ReturnType<typeof createDoctorFixture>>;
let admin: Awaited<ReturnType<typeof createReceptionFixture>>;

beforeAll(async () => {
  clinic = await createDoctorFixture(app);
  admin = await createReceptionFixture(app, clinic.clinicId, [], { role: UserRole.CLINIC_ADMIN });

  await request(app)
    .post('/api/v1/clinic/departments')
    .set('Authorization', `Bearer ${admin.token}`)
    .send({ clinicId: clinic.clinicId, name: 'Audit Test Department' });
});

describe('Clinic audit log', () => {
  it('records clinic-management mutations, scoped to this clinic', async () => {
    const res = await request(app).get(`/api/v1/clinic/audit-logs?clinicId=${clinic.clinicId}`).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.auditLog.items.length).toBeGreaterThan(0);
    expect(res.body.data.auditLog.items.some((e: { action: string }) => e.action === 'clinic.department_created')).toBe(true);
  });

  it('filters by action', async () => {
    const res = await request(app)
      .get(`/api/v1/clinic/audit-logs?clinicId=${clinic.clinicId}&action=department_created`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.auditLog.items.every((e: { action: string }) => e.action.includes('department_created'))).toBe(true);
  });

  it('filters by entityType', async () => {
    const res = await request(app)
      .get(`/api/v1/clinic/audit-logs?clinicId=${clinic.clinicId}&entityType=Department`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.auditLog.items.every((e: { entityType: string }) => e.entityType === 'Department')).toBe(true);
  });

  it('filters by date range excluding today returns no rows', async () => {
    const res = await request(app)
      .get(`/api/v1/clinic/audit-logs?clinicId=${clinic.clinicId}&from=2020-01-01&to=2020-01-02`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.auditLog.items.length).toBe(0);
  });
});

describe('Clinic reports', () => {
  it('returns a reports summary for a date range', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/api/v1/clinic/reports?clinicId=${clinic.clinicId}&from=${today}&to=${today}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.report.range.from).toBe(today);
    expect(typeof res.body.data.report.totalAppointments).toBe('number');
    expect(typeof res.body.data.report.revenue).toBe('string');
  });

  it('rejects an invalid date range (from after to)', async () => {
    const res = await request(app)
      .get(`/api/v1/clinic/reports?clinicId=${clinic.clinicId}&from=2026-06-10&to=2026-06-01`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(400);
  });
});
