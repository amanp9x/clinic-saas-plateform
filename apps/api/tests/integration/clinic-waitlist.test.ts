import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { CLINIC_PERMISSIONS } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, tomorrowInfo } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');

const app = createApp();

describe('POST /api/v1/clinic/waitlist', () => {
  it('reception with APPOINTMENT_MANAGE can add an existing patient to the waitlist', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.APPOINTMENT_MANAGE]);
    const { date } = tomorrowInfo();

    const res = await request(app)
      .post('/api/v1/clinic/waitlist')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ clinicId: fixture.clinicId, doctorId: fixture.doctorId, targetDate: date, patientId: patient.patientId });

    expect(res.status).toBe(201);
    expect(res.body.data.entry.patientId).toBe(patient.patientId);
  });

  it('reception with APPOINTMENT_MANAGE can add a brand-new patient inline', async () => {
    const fixture = await createDoctorFixture(app);
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.APPOINTMENT_MANAGE]);
    const { date } = tomorrowInfo();

    const res = await request(app)
      .post('/api/v1/clinic/waitlist')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ clinicId: fixture.clinicId, doctorId: fixture.doctorId, targetDate: date, newPatient: { fullName: 'Phone Caller', phone: '+919812300000' } });

    expect(res.status).toBe(201);
    expect(res.body.data.entry.patientName).toBe('Phone Caller');
  });

  it('rejects reception without APPOINTMENT_MANAGE', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.QUEUE_VIEW]);
    const { date } = tomorrowInfo();

    const res = await request(app)
      .post('/api/v1/clinic/waitlist')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ clinicId: fixture.clinicId, doctorId: fixture.doctorId, targetDate: date, patientId: patient.patientId });
    expect(res.status).toBe(403);
  });

  it('rejects a receptionist acting on a clinic they are not staff at', async () => {
    const fixtureA = await createDoctorFixture(app);
    const fixtureB = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const staffAtB = await createReceptionFixture(app, fixtureB.clinicId, [CLINIC_PERMISSIONS.APPOINTMENT_MANAGE]);
    const { date } = tomorrowInfo();

    const res = await request(app)
      .post('/api/v1/clinic/waitlist')
      .set('Authorization', `Bearer ${staffAtB.token}`)
      .send({ clinicId: fixtureA.clinicId, doctorId: fixtureA.doctorId, targetDate: date, patientId: patient.patientId });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/clinic/waitlist', () => {
  it('reception with QUEUE_VIEW can list the clinic queue, scoped strictly to their clinic', async () => {
    const fixtureA = await createDoctorFixture(app);
    const fixtureB = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const staffManage = await createReceptionFixture(app, fixtureA.clinicId, [CLINIC_PERMISSIONS.APPOINTMENT_MANAGE, CLINIC_PERMISSIONS.QUEUE_VIEW]);
    const { date } = tomorrowInfo();

    await request(app)
      .post('/api/v1/clinic/waitlist')
      .set('Authorization', `Bearer ${staffManage.token}`)
      .send({ clinicId: fixtureA.clinicId, doctorId: fixtureA.doctorId, targetDate: date, patientId: patient.patientId });

    const staffB = await createReceptionFixture(app, fixtureB.clinicId, [CLINIC_PERMISSIONS.QUEUE_VIEW]);
    const resB = await request(app).get(`/api/v1/clinic/waitlist?clinicId=${fixtureB.clinicId}`).set('Authorization', `Bearer ${staffB.token}`);
    expect(resB.status).toBe(200);
    expect(resB.body.data.items).toHaveLength(0);

    const resA = await request(app).get(`/api/v1/clinic/waitlist?clinicId=${fixtureA.clinicId}`).set('Authorization', `Bearer ${staffManage.token}`);
    expect(resA.status).toBe(200);
    expect(resA.body.data.items).toHaveLength(1);
  });

  it('rejects viewing without QUEUE_VIEW', async () => {
    const fixture = await createDoctorFixture(app);
    const staff = await createReceptionFixture(app, fixture.clinicId, []);
    const res = await request(app).get(`/api/v1/clinic/waitlist?clinicId=${fixture.clinicId}`).set('Authorization', `Bearer ${staff.token}`);
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/v1/clinic/waitlist/:id', () => {
  it('reception cancels a clinic waitlist entry', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.APPOINTMENT_MANAGE]);
    const { date } = tomorrowInfo();
    const created = await request(app)
      .post('/api/v1/clinic/waitlist')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ clinicId: fixture.clinicId, doctorId: fixture.doctorId, targetDate: date, patientId: patient.patientId });

    const res = await request(app)
      .delete(`/api/v1/clinic/waitlist/${created.body.data.entry.id}?clinicId=${fixture.clinicId}`)
      .set('Authorization', `Bearer ${staff.token}`);
    expect(res.status).toBe(200);
  });

  it('a foreign clinic cannot cancel another clinic\'s entry — 404, not leaking existence across clinics', async () => {
    const fixtureA = await createDoctorFixture(app);
    const fixtureB = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const staffA = await createReceptionFixture(app, fixtureA.clinicId, [CLINIC_PERMISSIONS.APPOINTMENT_MANAGE]);
    const staffB = await createReceptionFixture(app, fixtureB.clinicId, [CLINIC_PERMISSIONS.APPOINTMENT_MANAGE]);
    const { date } = tomorrowInfo();
    const created = await request(app)
      .post('/api/v1/clinic/waitlist')
      .set('Authorization', `Bearer ${staffA.token}`)
      .send({ clinicId: fixtureA.clinicId, doctorId: fixtureA.doctorId, targetDate: date, patientId: patient.patientId });

    const res = await request(app)
      .delete(`/api/v1/clinic/waitlist/${created.body.data.entry.id}?clinicId=${fixtureB.clinicId}`)
      .set('Authorization', `Bearer ${staffB.token}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/doctor/waitlist', () => {
  it('a doctor sees only their own waiting patients', async () => {
    const fixtureA = await createDoctorFixture(app);
    const fixtureB = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const { date } = tomorrowInfo();

    await request(app).post('/api/v1/waitlist').set('Authorization', `Bearer ${patient.token}`).send({ doctorId: fixtureA.doctorId, clinicId: fixtureA.clinicId, targetDate: date });

    const resA = await request(app).get('/api/v1/doctor/waitlist').set('Authorization', `Bearer ${fixtureA.token}`);
    expect(resA.status).toBe(200);
    expect(resA.body.data.items).toHaveLength(1);

    const resB = await request(app).get('/api/v1/doctor/waitlist').set('Authorization', `Bearer ${fixtureB.token}`);
    expect(resB.status).toBe(200);
    expect(resB.body.data.items).toHaveLength(0);
  });
});
