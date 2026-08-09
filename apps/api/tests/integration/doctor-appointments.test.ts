import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture, todayAt } = await import(
  '../helpers/doctor-fixtures.js'
);

const app = createApp();

let doctor: Awaited<ReturnType<typeof createDoctorFixture>>;
let patient: Awaited<ReturnType<typeof createPatientFixture>>;

beforeAll(async () => {
  doctor = await createDoctorFixture(app);
  patient = await createPatientFixture(app);
});

describe('GET /api/v1/doctor/appointments', () => {
  it("lists today's confirmed appointment", async () => {
    const appt = await createAppointmentFixture({
      patientId: patient.patientId,
      doctorId: doctor.doctorId,
      clinicId: doctor.clinicId,
      status: 'CONFIRMED',
      scheduledAt: todayAt(11, 0),
    });

    const res = await request(app)
      .get('/api/v1/doctor/appointments?tab=today')
      .set('Authorization', `Bearer ${doctor.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.some((i: { id: string }) => i.id === appt.id)).toBe(true);
    expect(res.body.data.items[0].patientName).toEqual(expect.any(String));
    expect(res.body.data.items[0].patientAge === null || typeof res.body.data.items[0].patientAge === 'number').toBe(
      true,
    );
  });

  it('scopes the list to clinicId when provided', async () => {
    const otherDoctor = await createDoctorFixture(app);
    const res = await request(app)
      .get(`/api/v1/doctor/appointments?tab=today&clinicId=${otherDoctor.clinicId}`)
      .set('Authorization', `Bearer ${doctor.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });
});

describe('Appointment detail and lifecycle actions', () => {
  it('starts a consultation, then rejects starting it again', async () => {
    const appt = await createAppointmentFixture({
      patientId: patient.patientId,
      doctorId: doctor.doctorId,
      clinicId: doctor.clinicId,
      status: 'CONFIRMED',
    });

    const startRes = await request(app)
      .post(`/api/v1/doctor/appointments/${appt.id}/start`)
      .set('Authorization', `Bearer ${doctor.token}`);
    expect(startRes.status).toBe(200);
    expect(startRes.body.data.appointment.status).toBe('IN_CONSULTATION');
    expect(startRes.body.data.appointment.consultationStatus).toBe('IN_PROGRESS');

    const secondStartRes = await request(app)
      .post(`/api/v1/doctor/appointments/${appt.id}/start`)
      .set('Authorization', `Bearer ${doctor.token}`);
    expect(secondStartRes.status).toBe(409);
  });

  it('marks an appointment as no-show', async () => {
    const appt = await createAppointmentFixture({
      patientId: patient.patientId,
      doctorId: doctor.doctorId,
      clinicId: doctor.clinicId,
      status: 'CONFIRMED',
    });

    const res = await request(app)
      .post(`/api/v1/doctor/appointments/${appt.id}/no-show`)
      .set('Authorization', `Bearer ${doctor.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.appointment.status).toBe('NO_SHOW');

    const again = await request(app)
      .post(`/api/v1/doctor/appointments/${appt.id}/no-show`)
      .set('Authorization', `Bearer ${doctor.token}`);
    expect(again.status).toBe(409);
  });

  it('rejects skipping an appointment with no live queue token', async () => {
    const appt = await createAppointmentFixture({
      patientId: patient.patientId,
      doctorId: doctor.doctorId,
      clinicId: doctor.clinicId,
      status: 'CONFIRMED',
    });

    const res = await request(app)
      .post(`/api/v1/doctor/appointments/${appt.id}/skip`)
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ reason: 'Running behind' });
    expect(res.status).toBe(409);
  });

  it("returns 404 for another doctor's appointment detail", async () => {
    const otherDoctor = await createDoctorFixture(app);
    const appt = await createAppointmentFixture({
      patientId: patient.patientId,
      doctorId: doctor.doctorId,
      clinicId: doctor.clinicId,
    });

    const res = await request(app)
      .get(`/api/v1/doctor/appointments/${appt.id}`)
      .set('Authorization', `Bearer ${otherDoctor.token}`);
    expect(res.status).toBe(404);
  });
});
