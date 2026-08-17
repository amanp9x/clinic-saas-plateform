import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { CLINIC_PERMISSIONS, UserRole } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');

const app = createApp();

describe('GET /api/v1/analytics/clinics/compare', () => {
  it('compares only clinics the caller is authorized for — a requested foreign clinic is silently dropped, not leaked', async () => {
    const fixtureA = await createDoctorFixture(app);
    const fixtureB = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixtureA.doctorId, clinicId: fixtureA.clinicId, status: 'COMPLETED' });
    await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixtureB.doctorId, clinicId: fixtureB.clinicId, status: 'COMPLETED' });

    // Staff member of clinic A only — never joined to clinic B.
    const staffA = await createReceptionFixture(app, fixtureA.clinicId, [CLINIC_PERMISSIONS.ANALYTICS_VIEW]);

    const res = await request(app)
      .get('/api/v1/analytics/clinics/compare')
      .query({ clinicIds: `${fixtureA.clinicId},${fixtureB.clinicId}`, range: 'last30days' })
      .set('Authorization', `Bearer ${staffA.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.rows).toHaveLength(1);
    expect(res.body.data.rows[0].clinicId).toBe(fixtureA.clinicId);
  });

  it('a CLINIC_ADMIN of both clinics sees both in the comparison, each with its own figures', async () => {
    const fixtureA = await createDoctorFixture(app);
    const fixtureB = await createDoctorFixture(app);
    const patientA = await createPatientFixture(app);
    const patientB = await createPatientFixture(app);
    await createAppointmentFixture({ patientId: patientA.patientId, doctorId: fixtureA.doctorId, clinicId: fixtureA.clinicId, status: 'COMPLETED' });
    await createAppointmentFixture({ patientId: patientB.patientId, doctorId: fixtureB.doctorId, clinicId: fixtureB.clinicId, status: 'COMPLETED' });
    await createAppointmentFixture({ patientId: patientB.patientId, doctorId: fixtureB.doctorId, clinicId: fixtureB.clinicId, status: 'COMPLETED' });

    const { prisma } = await import('../../src/config/database.js');
    const { hashPassword } = await import('../../src/utils/password.js');
    const email = `dual-clinic-admin-${Date.now()}@example.com`;
    const user = await prisma.user.create({ data: { email, passwordHash: await hashPassword('AdminPass123!'), role: UserRole.CLINIC_ADMIN, isEmailVerified: true, isActive: true } });
    await prisma.clinicStaffMember.create({ data: { userId: user.id, clinicId: fixtureA.clinicId, permissions: [] } });
    await prisma.clinicStaffMember.create({ data: { userId: user.id, clinicId: fixtureB.clinicId, permissions: [] } });
    const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password: 'AdminPass123!' });
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.data.accessToken as string;

    const res = await request(app)
      .get('/api/v1/analytics/clinics/compare')
      .query({ clinicIds: `${fixtureA.clinicId},${fixtureB.clinicId}`, range: 'last30days' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.rows).toHaveLength(2);
    const rowA = res.body.data.rows.find((r: { clinicId: string }) => r.clinicId === fixtureA.clinicId);
    const rowB = res.body.data.rows.find((r: { clinicId: string }) => r.clinicId === fixtureB.clinicId);
    expect(rowA.appointments).toBe(1);
    expect(rowB.appointments).toBe(2);
  });

  it('a caller with no accessible clinics at all gets an empty comparison, not an error', async () => {
    const fixtureA = await createDoctorFixture(app);
    const fixtureB = await createDoctorFixture(app);
    const outsider = await createReceptionFixture(app, fixtureA.clinicId, []); // no ANALYTICS_VIEW grant

    const res = await request(app)
      .get('/api/v1/analytics/clinics/compare')
      .query({ clinicIds: `${fixtureA.clinicId},${fixtureB.clinicId}`, range: 'last30days' })
      .set('Authorization', `Bearer ${outsider.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.rows).toEqual([]);
  });
});
