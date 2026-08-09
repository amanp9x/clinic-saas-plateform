import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

const { createApp } = await import('../../src/app.js');
const { DEMO_DOCTOR_EMAIL, DEMO_DOCTOR_PASSWORD, DEMO_PATIENT_EMAIL, DEMO_PATIENT_PASSWORD } = await import(
  '../../prisma/seed-constants.js'
);
const { createDoctorFixture } = await import('../helpers/doctor-fixtures.js');

const app = createApp();

async function loginDemoDoctor(): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: DEMO_DOCTOR_EMAIL, password: DEMO_DOCTOR_PASSWORD });
  if (res.status !== 200) {
    throw new Error(`Demo doctor login failed: ${JSON.stringify(res.body)}`);
  }
  return res.body.data.accessToken;
}

async function loginDemoPatient(): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: DEMO_PATIENT_EMAIL, password: DEMO_PATIENT_PASSWORD });
  return res.body.data.accessToken;
}

let demoDoctorToken: string;

beforeAll(async () => {
  demoDoctorToken = await loginDemoDoctor();
});

describe('Doctor Portal authentication', () => {
  it('logs the seeded demo doctor in and returns a DOCTOR role', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: DEMO_DOCTOR_EMAIL, password: DEMO_DOCTOR_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('DOCTOR');
  });
});

describe('Doctor Portal RBAC', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/v1/doctor/dashboard');
    expect(res.status).toBe(401);
  });

  it('rejects a PATIENT-role token on doctor routes', async () => {
    const patientToken = await loginDemoPatient();
    const res = await request(app)
      .get('/api/v1/doctor/dashboard')
      .set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(403);
  });

  it('rejects a DOCTOR-role token on patient-only routes', async () => {
    const res = await request(app)
      .get('/api/v1/patient/profile')
      .set('Authorization', `Bearer ${demoDoctorToken}`);
    expect(res.status).toBe(403);
  });

  it('allows a DOCTOR-role token on doctor routes', async () => {
    const res = await request(app)
      .get('/api/v1/doctor/profile')
      .set('Authorization', `Bearer ${demoDoctorToken}`);
    expect(res.status).toBe(200);
  });
});

describe('Cross-doctor ownership', () => {
  it("returns 404 (not 403) for another doctor's appointment", async () => {
    const otherDoctor = await createDoctorFixture(app);
    const listRes = await request(app)
      .get('/api/v1/doctor/appointments?tab=today')
      .set('Authorization', `Bearer ${demoDoctorToken}`);
    const demoAppointmentId = listRes.body.data.items[0]?.id;
    if (!demoAppointmentId) return;

    const res = await request(app)
      .get(`/api/v1/doctor/appointments/${demoAppointmentId}`)
      .set('Authorization', `Bearer ${otherDoctor.token}`);
    expect(res.status).toBe(404);
  });
});
