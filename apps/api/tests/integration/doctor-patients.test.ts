import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture } = await import(
  '../helpers/doctor-fixtures.js'
);

const app = createApp();

let doctor: Awaited<ReturnType<typeof createDoctorFixture>>;
let unrelatedDoctor: Awaited<ReturnType<typeof createDoctorFixture>>;
let patient: Awaited<ReturnType<typeof createPatientFixture>>;
let strangerPatient: Awaited<ReturnType<typeof createPatientFixture>>;

beforeAll(async () => {
  doctor = await createDoctorFixture(app);
  unrelatedDoctor = await createDoctorFixture(app);
  patient = await createPatientFixture(app);
  strangerPatient = await createPatientFixture(app);

  await createAppointmentFixture({
    patientId: patient.patientId,
    doctorId: doctor.doctorId,
    clinicId: doctor.clinicId,
  });
});

describe('Continuity-of-care patient record authorization', () => {
  it('allows a doctor with an appointment relationship to view the patient profile', async () => {
    const res = await request(app)
      .get(`/api/v1/doctor/patients/${patient.patientId}`)
      .set('Authorization', `Bearer ${doctor.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.patient.id).toBe(patient.patientId);
  });

  it('allows the same doctor to view full medical history', async () => {
    const res = await request(app)
      .get(`/api/v1/doctor/patients/${patient.patientId}/medical-history`)
      .set('Authorization', `Bearer ${doctor.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.history.profile.id).toBe(patient.patientId);
    expect(Array.isArray(res.body.data.history.appointments)).toBe(true);
  });

  it('returns 404 (not 403) for a doctor with no appointment relationship to the patient', async () => {
    const res = await request(app)
      .get(`/api/v1/doctor/patients/${strangerPatient.patientId}`)
      .set('Authorization', `Bearer ${unrelatedDoctor.token}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 for medical history with no relationship', async () => {
    const res = await request(app)
      .get(`/api/v1/doctor/patients/${strangerPatient.patientId}/medical-history`)
      .set('Authorization', `Bearer ${unrelatedDoctor.token}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 for a nonexistent patient id', async () => {
    const res = await request(app)
      .get('/api/v1/doctor/patients/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${doctor.token}`);
    expect(res.status).toBe(404);
  });
});
