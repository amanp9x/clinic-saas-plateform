import { describe, expect, it } from 'vitest';
import request from 'supertest';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, tomorrowInfo } = await import('../helpers/doctor-fixtures.js');

const app = createApp();

describe('POST /api/v1/waitlist', () => {
  it('a patient can join the waitlist for a doctor+clinic+future date', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const { date } = tomorrowInfo();

    const res = await request(app)
      .post('/api/v1/waitlist')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, targetDate: date, notes: 'Prefer morning' });

    expect(res.status).toBe(201);
    expect(res.body.data.entry.status).toBe('ACTIVE');
    expect(res.body.data.entry.canCancel).toBe(true);
    expect(res.body.data.entry.doctorId).toBe(fixture.doctorId);
    expect(res.body.data.entry.targetDate).toBe(date);
  });

  it('rejects a doctor who is not actually at this clinic', async () => {
    const fixtureA = await createDoctorFixture(app);
    const fixtureB = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const { date } = tomorrowInfo();

    const res = await request(app)
      .post('/api/v1/waitlist')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ doctorId: fixtureA.doctorId, clinicId: fixtureB.clinicId, targetDate: date });
    expect(res.status).toBe(404);
  });

  it('rejects a target date in the past', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);

    const res = await request(app)
      .post('/api/v1/waitlist')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, targetDate: dateStr });
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate active entry for the same patient+doctor+clinic+date', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const { date } = tomorrowInfo();

    await request(app).post('/api/v1/waitlist').set('Authorization', `Bearer ${patient.token}`).send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, targetDate: date });
    const res = await request(app)
      .post('/api/v1/waitlist')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, targetDate: date });
    expect(res.status).toBe(409);
  });

  it('allows rejoining after the previous entry was cancelled', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const { date } = tomorrowInfo();

    const first = await request(app).post('/api/v1/waitlist').set('Authorization', `Bearer ${patient.token}`).send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, targetDate: date });
    await request(app).delete(`/api/v1/waitlist/${first.body.data.entry.id}`).set('Authorization', `Bearer ${patient.token}`);

    const second = await request(app)
      .post('/api/v1/waitlist')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, targetDate: date });
    expect(second.status).toBe(201);
  });

  it('a doctor token cannot use the patient-only waitlist endpoint', async () => {
    const fixture = await createDoctorFixture(app);
    const { date } = tomorrowInfo();
    const res = await request(app)
      .post('/api/v1/waitlist')
      .set('Authorization', `Bearer ${fixture.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, targetDate: date });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/waitlist/my', () => {
  it('lists only the caller\'s own entries', async () => {
    const fixture = await createDoctorFixture(app);
    const patientA = await createPatientFixture(app);
    const patientB = await createPatientFixture(app);
    const { date } = tomorrowInfo();

    await request(app).post('/api/v1/waitlist').set('Authorization', `Bearer ${patientA.token}`).send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, targetDate: date });
    await request(app).post('/api/v1/waitlist').set('Authorization', `Bearer ${patientB.token}`).send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, targetDate: date });

    const res = await request(app).get('/api/v1/waitlist/my').set('Authorization', `Bearer ${patientA.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.total).toBe(1);
  });
});

describe('DELETE /api/v1/waitlist/:id', () => {
  it('cancels the caller\'s own entry', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const { date } = tomorrowInfo();
    const created = await request(app).post('/api/v1/waitlist').set('Authorization', `Bearer ${patient.token}`).send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, targetDate: date });

    const res = await request(app).delete(`/api/v1/waitlist/${created.body.data.entry.id}`).set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(200);

    const list = await request(app).get('/api/v1/waitlist/my?status=CANCELLED').set('Authorization', `Bearer ${patient.token}`);
    expect(list.body.data.items).toHaveLength(1);
  });

  it('a patient cannot cancel another patient\'s entry — 404, not 403 (IDOR-safe)', async () => {
    const fixture = await createDoctorFixture(app);
    const patientA = await createPatientFixture(app);
    const patientB = await createPatientFixture(app);
    const { date } = tomorrowInfo();
    const created = await request(app).post('/api/v1/waitlist').set('Authorization', `Bearer ${patientA.token}`).send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, targetDate: date });

    const res = await request(app).delete(`/api/v1/waitlist/${created.body.data.entry.id}`).set('Authorization', `Bearer ${patientB.token}`);
    expect(res.status).toBe(404);
  });

  it('cancelling an already-cancelled entry returns 409, not a silent 200', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const { date } = tomorrowInfo();
    const created = await request(app).post('/api/v1/waitlist').set('Authorization', `Bearer ${patient.token}`).send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, targetDate: date });
    await request(app).delete(`/api/v1/waitlist/${created.body.data.entry.id}`).set('Authorization', `Bearer ${patient.token}`);

    const res = await request(app).delete(`/api/v1/waitlist/${created.body.data.entry.id}`).set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(409);
  });

  it('cancelling a nonexistent entry returns 404', async () => {
    const patient = await createPatientFixture(app);
    const res = await request(app).delete('/api/v1/waitlist/00000000-0000-0000-0000-000000000000').set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(404);
  });
});
