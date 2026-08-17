import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { UserRole } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');

const app = createApp();

async function adminFor(clinicId: string) {
  return createReceptionFixture(app, clinicId, [], { role: UserRole.CLINIC_ADMIN });
}

describe('Report pagination', () => {
  it('defaults to page size 25', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const admin = await adminFor(fixture.clinicId);
    for (let i = 0; i < 30; i++) {
      await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });
    }
    const res = await request(app).get('/api/v1/analytics/reports/appointments').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(25);
    expect(res.body.data.limit).toBe(25);
    expect(res.body.data.total).toBe(30);
    expect(res.body.data.totalPages).toBe(2);
  });

  it('rejects a limit above 100', async () => {
    const fixture = await createDoctorFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const res = await request(app).get('/api/v1/analytics/reports/appointments').query({ clinicId: fixture.clinicId, range: 'today', limit: 500 }).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(400);
  });

  it('accepts limit up to 100 and page 2 returns the remainder', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const admin = await adminFor(fixture.clinicId);
    for (let i = 0; i < 30; i++) {
      await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });
    }
    const page2 = await request(app).get('/api/v1/analytics/reports/appointments').query({ clinicId: fixture.clinicId, range: 'today', page: 2, limit: 25 }).set('Authorization', `Bearer ${admin.token}`);
    expect(page2.body.data.items).toHaveLength(5);
  });

  it('an out-of-range page returns an empty (not erroring) items array', async () => {
    const fixture = await createDoctorFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const res = await request(app).get('/api/v1/analytics/reports/appointments').query({ clinicId: fixture.clinicId, range: 'today', page: 99 }).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });
});

describe('Report sorting and filtering', () => {
  it('sorts appointments by scheduledAt ascending/descending', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const early = new Date();
    early.setHours(8, 0, 0, 0);
    const late = new Date();
    late.setHours(16, 0, 0, 0);
    await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED', scheduledAt: early });
    await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED', scheduledAt: late });

    const asc = await request(app).get('/api/v1/analytics/reports/appointments').query({ clinicId: fixture.clinicId, range: 'today', sortDir: 'asc' }).set('Authorization', `Bearer ${admin.token}`);
    expect(new Date(asc.body.data.items[0].scheduledAt).getTime()).toBeLessThan(new Date(asc.body.data.items[1].scheduledAt).getTime());

    const desc = await request(app).get('/api/v1/analytics/reports/appointments').query({ clinicId: fixture.clinicId, range: 'today', sortDir: 'desc' }).set('Authorization', `Bearer ${admin.token}`);
    expect(new Date(desc.body.data.items[0].scheduledAt).getTime()).toBeGreaterThan(new Date(desc.body.data.items[1].scheduledAt).getTime());
  });

  it('filters the appointment report by status', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const admin = await adminFor(fixture.clinicId);
    await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });
    await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'CANCELLED' });

    const res = await request(app).get('/api/v1/analytics/reports/appointments').query({ clinicId: fixture.clinicId, range: 'today', status: 'CANCELLED' }).set('Authorization', `Bearer ${admin.token}`);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].status).toBe('CANCELLED');
  });

  it('never allows filtering into a doctor outside the clinic — a foreign doctorId yields zero rows, not another clinic\'s data', async () => {
    const fixtureA = await createDoctorFixture(app);
    const fixtureB = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const admin = await adminFor(fixtureA.clinicId);
    await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixtureA.doctorId, clinicId: fixtureA.clinicId, status: 'COMPLETED' });

    const res = await request(app)
      .get('/api/v1/analytics/reports/appointments')
      .query({ clinicId: fixtureA.clinicId, range: 'today', doctorId: fixtureB.doctorId })
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });
});

describe('CSV export', () => {
  it('respects the same filters as the report endpoint and contains no unauthorized rows', async () => {
    const fixtureA = await createDoctorFixture(app);
    const fixtureB = await createDoctorFixture(app);
    const patientA = await createPatientFixture(app);
    const patientB = await createPatientFixture(app);
    const adminA = await createReceptionFixture(app, fixtureA.clinicId, [], { role: UserRole.CLINIC_ADMIN });
    await createReceptionFixture(app, fixtureB.clinicId, [], { role: UserRole.CLINIC_ADMIN });
    await createAppointmentFixture({ patientId: patientA.patientId, doctorId: fixtureA.doctorId, clinicId: fixtureA.clinicId, status: 'COMPLETED' });
    await createAppointmentFixture({ patientId: patientB.patientId, doctorId: fixtureB.doctorId, clinicId: fixtureB.clinicId, status: 'COMPLETED' });

    const res = await request(app).get('/api/v1/analytics/export/appointments').query({ clinicId: fixtureA.clinicId, range: 'today' }).set('Authorization', `Bearer ${adminA.token}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Booking Reference');
    // Only clinic A's own data — clinic B's patient/doctor names never appear in clinic A's export.
    const rowCount = res.text.trim().split('\r\n').length - 1; // minus header
    expect(rowCount).toBe(1);
  });

  it('a staff member without ANALYTICS_EXPORT cannot export even though they can view the report', async () => {
    const { CLINIC_PERMISSIONS } = await import('@clinic/shared');
    const fixture = await createDoctorFixture(app);
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.ANALYTICS_VIEW]);
    const viewRes = await request(app).get('/api/v1/analytics/reports/appointments').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${staff.token}`);
    expect(viewRes.status).toBe(200);
    const exportRes = await request(app).get('/api/v1/analytics/export/appointments').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${staff.token}`);
    expect(exportRes.status).toBe(403);
  });

  it('returns a valid empty CSV (header only) when there is no data — not an error', async () => {
    const fixture = await createDoctorFixture(app);
    const { CLINIC_PERMISSIONS } = await import('@clinic/shared');
    // Export builds on top of view access (the reused report functions still require
    // ANALYTICS_VIEW) — a realistic grant gives both together, matching the "an export permission
    // without view access doesn't make sense operationally" design documented in export.service.ts.
    const admin = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.ANALYTICS_VIEW, CLINIC_PERMISSIONS.ANALYTICS_EXPORT]);
    const res = await request(app).get('/api/v1/analytics/export/appointments').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.text.trim().split('\r\n')).toHaveLength(1); // header row only
  });

  it('the revenue export never includes card/provider secrets — only amount/status/method columns', async () => {
    const fixture = await createDoctorFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const res = await request(app).get('/api/v1/analytics/export/revenue').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.text.toLowerCase()).not.toContain('cvv');
    expect(res.text.toLowerCase()).not.toContain('providerpaymentid');
    expect(res.text.toLowerCase()).not.toContain('signature');
  });
});
