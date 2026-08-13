import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ALL_CLINIC_PERMISSIONS, CLINIC_PERMISSIONS } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');

const app = createApp();

let doctor: Awaited<ReturnType<typeof createDoctorFixture>>;
let otherClinicDoctor: Awaited<ReturnType<typeof createDoctorFixture>>;
let reception: Awaited<ReturnType<typeof createReceptionFixture>>;

beforeAll(async () => {
  doctor = await createDoctorFixture(app);
  otherClinicDoctor = await createDoctorFixture(app);
  reception = await createReceptionFixture(app, doctor.clinicId, ALL_CLINIC_PERMISSIONS);
});

describe('Doctor status control', () => {
  it('updates a doctor manual status and reflects it in the status list', async () => {
    const res = await request(app)
      .patch(`/api/v1/reception/doctors/${doctor.doctorId}/status`)
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ clinicId: doctor.clinicId, status: 'ON_BREAK' });
    expect(res.status).toBe(200);

    const listRes = await request(app)
      .get(`/api/v1/reception/doctors/status?clinicId=${doctor.clinicId}`)
      .set('Authorization', `Bearer ${reception.token}`);
    expect(listRes.status).toBe(200);
    const entry = listRes.body.data.doctors.find((d: { doctorId: string }) => d.doctorId === doctor.doctorId);
    expect(entry.status).toBe('ON_BREAK');
  });

  it('rejects status updates without the doctor.status.update permission', async () => {
    const noPerm = await createReceptionFixture(app, doctor.clinicId, [CLINIC_PERMISSIONS.QUEUE_VIEW]);
    const res = await request(app)
      .patch(`/api/v1/reception/doctors/${doctor.doctorId}/status`)
      .set('Authorization', `Bearer ${noPerm.token}`)
      .send({ clinicId: doctor.clinicId, status: 'AVAILABLE' });
    expect(res.status).toBe(403);
  });

  it('rejects a doctor not associated with the clinic', async () => {
    const res = await request(app)
      .patch(`/api/v1/reception/doctors/${otherClinicDoctor.doctorId}/status`)
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ clinicId: doctor.clinicId, status: 'AVAILABLE' });
    expect(res.status).toBe(404);
  });
});

describe('Patient search — clinic scoped', () => {
  it('finds a patient who has an appointment at this clinic', async () => {
    const patient = await createPatientFixture(app);
    await createAppointmentFixture({ patientId: patient.patientId, doctorId: doctor.doctorId, clinicId: doctor.clinicId, status: 'CONFIRMED' });

    const res = await request(app)
      .get(`/api/v1/reception/patients/search?clinicId=${doctor.clinicId}&q=${encodeURIComponent('Fixture Patient')}`)
      .set('Authorization', `Bearer ${reception.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.patients.items.some((p: { id: string }) => p.id === patient.patientId)).toBe(true);
  });

  it('never returns a patient who only has appointments at a different clinic', async () => {
    const patient = await createPatientFixture(app);
    await createAppointmentFixture({ patientId: patient.patientId, doctorId: otherClinicDoctor.doctorId, clinicId: otherClinicDoctor.clinicId, status: 'CONFIRMED' });

    const res = await request(app)
      .get(`/api/v1/reception/patients/search?clinicId=${doctor.clinicId}&q=${encodeURIComponent('Fixture Patient')}`)
      .set('Authorization', `Bearer ${reception.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.patients.items.some((p: { id: string }) => p.id === patient.patientId)).toBe(false);
  });

  it('returns a limited quick-view without full medical history', async () => {
    const patient = await createPatientFixture(app);
    await createAppointmentFixture({ patientId: patient.patientId, doctorId: doctor.doctorId, clinicId: doctor.clinicId, status: 'CONFIRMED' });

    const res = await request(app)
      .get(`/api/v1/reception/patients/${patient.patientId}?clinicId=${doctor.clinicId}`)
      .set('Authorization', `Bearer ${reception.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.patient.id).toBe(patient.patientId);
    expect(res.body.data.patient).not.toHaveProperty('allergies');
    expect(res.body.data.patient).not.toHaveProperty('medicalConditions');
  });
});

describe('Dashboard and reports', () => {
  it('returns a dashboard summary for the clinic', async () => {
    const res = await request(app)
      .get(`/api/v1/reception/dashboard?clinicId=${doctor.clinicId}`)
      .set('Authorization', `Bearer ${reception.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.summary.clinicId).toBe(doctor.clinicId);
    expect(Array.isArray(res.body.data.summary.doctorQueues)).toBe(true);
  });

  it('rejects reports without the reports.view permission', async () => {
    const noPerm = await createReceptionFixture(app, doctor.clinicId, [CLINIC_PERMISSIONS.QUEUE_VIEW]);
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/api/v1/reception/reports?clinicId=${doctor.clinicId}&from=${today}&to=${today}`)
      .set('Authorization', `Bearer ${noPerm.token}`);
    expect(res.status).toBe(403);
  });

  it('returns a reports summary for a date range', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/api/v1/reception/reports?clinicId=${doctor.clinicId}&from=${today}&to=${today}`)
      .set('Authorization', `Bearer ${reception.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.report.range.from).toBe(today);
    expect(typeof res.body.data.report.totalAppointments).toBe('number');
  });
});

describe('Reception profile', () => {
  it('lists the clinics this staff member belongs to', async () => {
    const res = await request(app).get('/api/v1/reception/clinics').set('Authorization', `Bearer ${reception.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.clinics.some((c: { clinicId: string }) => c.clinicId === doctor.clinicId)).toBe(true);
  });
});
