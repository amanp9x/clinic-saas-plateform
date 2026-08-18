import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { CLINIC_PERMISSIONS } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture, completeConsultationFixture } = await import(
  '../helpers/doctor-fixtures.js'
);
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');

const app = createApp();

function daysFromNow(days: number): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60_000);
  return d.toISOString().slice(0, 10);
}

describe('GET /api/v1/doctor/follow-ups', () => {
  it('a doctor sees only their own consultations with a follow-up recommended', async () => {
    const fixtureA = await createDoctorFixture(app);
    const fixtureB = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixtureA.doctorId, clinicId: fixtureA.clinicId, status: 'CONFIRMED' });
    await completeConsultationFixture(app, { doctorToken: fixtureA.token, appointmentId: appt.id, followUpDate: daysFromNow(5) });

    const resA = await request(app).get('/api/v1/doctor/follow-ups').set('Authorization', `Bearer ${fixtureA.token}`);
    expect(resA.status).toBe(200);
    expect(resA.body.data.items).toHaveLength(1);
    expect(resA.body.data.items[0].isOverdue).toBe(false);

    const resB = await request(app).get('/api/v1/doctor/follow-ups').set('Authorization', `Bearer ${fixtureB.token}`);
    expect(resB.status).toBe(200);
    expect(resB.body.data.items).toHaveLength(0);
  });

  it('marks a past follow-up date as overdue', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'CONFIRMED' });
    await completeConsultationFixture(app, { doctorToken: fixture.token, appointmentId: appt.id, followUpDate: daysFromNow(-2) });

    const res = await request(app).get('/api/v1/doctor/follow-ups').set('Authorization', `Bearer ${fixture.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items[0].isOverdue).toBe(true);
  });

  it('a completed consultation with no follow-up recommended never appears', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'CONFIRMED' });
    await completeConsultationFixture(app, { doctorToken: fixture.token, appointmentId: appt.id });

    const res = await request(app).get('/api/v1/doctor/follow-ups').set('Authorization', `Bearer ${fixture.token}`);
    expect(res.body.data.items).toHaveLength(0);
  });
});

describe('GET /api/v1/clinic/follow-ups', () => {
  it('reception with QUEUE_VIEW sees the clinic\'s follow-ups, scoped strictly to their clinic', async () => {
    const fixtureA = await createDoctorFixture(app);
    const fixtureB = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixtureA.doctorId, clinicId: fixtureA.clinicId, status: 'CONFIRMED' });
    await completeConsultationFixture(app, { doctorToken: fixtureA.token, appointmentId: appt.id, followUpDate: daysFromNow(3) });

    const staffA = await createReceptionFixture(app, fixtureA.clinicId, [CLINIC_PERMISSIONS.QUEUE_VIEW]);
    const resA = await request(app).get(`/api/v1/clinic/follow-ups?clinicId=${fixtureA.clinicId}`).set('Authorization', `Bearer ${staffA.token}`);
    expect(resA.status).toBe(200);
    expect(resA.body.data.items).toHaveLength(1);
    expect(resA.body.data.items[0].patientPhone === null || typeof resA.body.data.items[0].patientPhone === 'string').toBe(true);

    const staffB = await createReceptionFixture(app, fixtureB.clinicId, [CLINIC_PERMISSIONS.QUEUE_VIEW]);
    const resB = await request(app).get(`/api/v1/clinic/follow-ups?clinicId=${fixtureB.clinicId}`).set('Authorization', `Bearer ${staffB.token}`);
    expect(resB.status).toBe(200);
    expect(resB.body.data.items).toHaveLength(0);
  });

  it('rejects reception without QUEUE_VIEW', async () => {
    const fixture = await createDoctorFixture(app);
    const staff = await createReceptionFixture(app, fixture.clinicId, []);
    const res = await request(app).get(`/api/v1/clinic/follow-ups?clinicId=${fixture.clinicId}`).set('Authorization', `Bearer ${staff.token}`);
    expect(res.status).toBe(403);
  });

  it('rejects a receptionist acting on a clinic they are not staff at', async () => {
    const fixtureA = await createDoctorFixture(app);
    const fixtureB = await createDoctorFixture(app);
    const staffAtB = await createReceptionFixture(app, fixtureB.clinicId, [CLINIC_PERMISSIONS.QUEUE_VIEW]);
    const res = await request(app).get(`/api/v1/clinic/follow-ups?clinicId=${fixtureA.clinicId}`).set('Authorization', `Bearer ${staffAtB.token}`);
    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request', async () => {
    const fixture = await createDoctorFixture(app);
    const res = await request(app).get(`/api/v1/clinic/follow-ups?clinicId=${fixture.clinicId}`);
    expect(res.status).toBe(401);
  });
});
