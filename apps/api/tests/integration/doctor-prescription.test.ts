import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture } = await import(
  '../helpers/doctor-fixtures.js'
);

const app = createApp();

let doctor: Awaited<ReturnType<typeof createDoctorFixture>>;
let otherDoctor: Awaited<ReturnType<typeof createDoctorFixture>>;
let patient: Awaited<ReturnType<typeof createPatientFixture>>;

beforeAll(async () => {
  doctor = await createDoctorFixture(app);
  otherDoctor = await createDoctorFixture(app);
  patient = await createPatientFixture(app);
  await createAppointmentFixture({ patientId: patient.patientId, doctorId: doctor.doctorId, clinicId: doctor.clinicId });
});

describe('Prescription draft → finalize workflow', () => {
  it('rejects creating a prescription for a patient with no care relationship', async () => {
    const strangerPatient = await createPatientFixture(app);
    const res = await request(app)
      .post('/api/v1/doctor/prescriptions')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({
        patientId: strangerPatient.patientId,
        items: [{ medicineName: 'Amoxicillin', dosage: '500mg', frequency: 'Twice daily', duration: '5 days' }],
      });
    expect(res.status).toBe(404);
  });

  it('creates a draft, edits it, then finalizes it into an immutable PDF-backed record', async () => {
    const createRes = await request(app)
      .post('/api/v1/doctor/prescriptions')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({
        patientId: patient.patientId,
        diagnosis: 'Bacterial throat infection',
        advice: 'Warm saline gargles',
        items: [
          {
            medicineName: 'Amoxicillin',
            dosage: '500mg',
            frequency: 'Twice daily',
            duration: '5 days',
            beforeAfterFood: 'AFTER_FOOD',
          },
        ],
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.prescription.status).toBe('DRAFT');
    const id = createRes.body.data.prescription.id;

    const updateRes = await request(app)
      .patch(`/api/v1/doctor/prescriptions/${id}`)
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({
        diagnosis: 'Bacterial throat infection, confirmed',
        items: [
          { medicineName: 'Amoxicillin', dosage: '500mg', frequency: 'Twice daily', duration: '7 days' },
          { medicineName: 'Paracetamol', dosage: '650mg', frequency: 'As needed', duration: '5 days' },
        ],
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.prescription.items).toHaveLength(2);

    const finalizeRes = await request(app)
      .post(`/api/v1/doctor/prescriptions/${id}/finalize`)
      .set('Authorization', `Bearer ${doctor.token}`);
    expect(finalizeRes.status).toBe(200);
    expect(finalizeRes.body.data.prescription.status).toBe('FINALIZED');
    expect(finalizeRes.body.data.prescription.pdfUrl).toContain('/uploads/prescriptions/');

    const editAfterFinalizeRes = await request(app)
      .patch(`/api/v1/doctor/prescriptions/${id}`)
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ diagnosis: 'Should not be allowed', items: [{ medicineName: 'X', dosage: '1', frequency: '1', duration: '1' }] });
    expect(editAfterFinalizeRes.status).toBe(409);

    const pdfRes = await request(app)
      .get(`/api/v1/doctor/prescriptions/${id}/pdf`)
      .set('Authorization', `Bearer ${doctor.token}`);
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toContain('application/pdf');

    const unauthorizedRes = await request(app)
      .get(`/api/v1/doctor/prescriptions/${id}`)
      .set('Authorization', `Bearer ${otherDoctor.token}`);
    expect(unauthorizedRes.status).toBe(404);

    const patientPrescriptionsRes = await request(app)
      .get('/api/v1/medical-records/prescriptions')
      .set('Authorization', `Bearer ${patient.token}`);
    expect(patientPrescriptionsRes.status).toBe(200);
    expect(patientPrescriptionsRes.body.data.prescriptions.length).toBeGreaterThan(0);
  });
});

describe('Doctor signature settings', () => {
  it('sets a typed signature and reflects it on the next finalized prescription', async () => {
    const setRes = await request(app)
      .put('/api/v1/doctor/settings/signature')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ signatureText: 'Dr. Fixture, MBBS' });
    expect(setRes.status).toBe(200);
    expect(setRes.body.data.signature.signatureText).toBe('Dr. Fixture, MBBS');

    const getRes = await request(app)
      .get('/api/v1/doctor/settings/signature')
      .set('Authorization', `Bearer ${doctor.token}`);
    expect(getRes.body.data.signature.signatureText).toBe('Dr. Fixture, MBBS');
  });
});
