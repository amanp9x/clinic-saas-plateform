import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture } = await import('../helpers/doctor-fixtures.js');

const app = createApp();

let patientToken: string;
let doctorToken: string;
let doctorId: string;
let clinicId: string;
let otherDoctorId: string;

beforeAll(async () => {
  const patient = await createPatientFixture(app);
  patientToken = patient.token;

  const doctorFixture = await createDoctorFixture(app);
  doctorToken = doctorFixture.token;
  doctorId = doctorFixture.doctorId;
  clinicId = doctorFixture.clinicId;

  const other = await createDoctorFixture(app);
  otherDoctorId = other.doctorId;
});

describe('Favorites — authorization', () => {
  it('rejects an unauthenticated save', async () => {
    const res = await request(app).post(`/api/v1/favorites/doctors/${doctorId}`);
    expect(res.status).toBe(401);
  });

  it('rejects a non-patient role', async () => {
    const res = await request(app)
      .post(`/api/v1/favorites/doctors/${doctorId}`)
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(res.status).toBe(403);
  });
});

describe('Favorites — doctor', () => {
  it('saves a doctor favorite', async () => {
    const res = await request(app)
      .post(`/api/v1/favorites/doctors/${doctorId}`)
      .set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(201);
  });

  it('is idempotent on a duplicate save', async () => {
    const res = await request(app)
      .post(`/api/v1/favorites/doctors/${doctorId}`)
      .set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(201);
  });

  it('appears in the favorites list', async () => {
    const res = await request(app).get('/api/v1/favorites').set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.doctors.some((d: { id: string }) => d.id === doctorId)).toBe(true);
  });

  it('returns 404 for a non-existent doctor', async () => {
    const res = await request(app)
      .post('/api/v1/favorites/doctors/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(404);
  });

  it('removes the doctor favorite', async () => {
    const res = await request(app)
      .delete(`/api/v1/favorites/doctors/${doctorId}`)
      .set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(200);

    const list = await request(app).get('/api/v1/favorites').set('Authorization', `Bearer ${patientToken}`);
    expect(list.body.data.doctors.some((d: { id: string }) => d.id === doctorId)).toBe(false);
  });

  it('removing a non-favorited doctor is a no-op, not an error', async () => {
    const res = await request(app)
      .delete(`/api/v1/favorites/doctors/${otherDoctorId}`)
      .set('Authorization', `Bearer ${patientToken}`);
    expect(res.status).toBe(200);
  });
});

describe('Favorites — clinic', () => {
  it('saves, lists, and removes a clinic favorite', async () => {
    const save = await request(app)
      .post(`/api/v1/favorites/clinics/${clinicId}`)
      .set('Authorization', `Bearer ${patientToken}`);
    expect(save.status).toBe(201);

    const list = await request(app).get('/api/v1/favorites').set('Authorization', `Bearer ${patientToken}`);
    expect(list.body.data.clinics.some((c: { id: string }) => c.id === clinicId)).toBe(true);

    const remove = await request(app)
      .delete(`/api/v1/favorites/clinics/${clinicId}`)
      .set('Authorization', `Bearer ${patientToken}`);
    expect(remove.status).toBe(200);

    const listAfter = await request(app).get('/api/v1/favorites').set('Authorization', `Bearer ${patientToken}`);
    expect(listAfter.body.data.clinics.some((c: { id: string }) => c.id === clinicId)).toBe(false);
  });
});
