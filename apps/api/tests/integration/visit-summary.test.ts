import { describe, expect, it } from 'vitest';
import request from 'supertest';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture, completeConsultationFixture } = await import(
  '../helpers/doctor-fixtures.js'
);

const app = createApp();

describe('GET /api/v1/appointments/:id/visit-summary', () => {
  it('returns the joined consultation + prescription for a completed visit', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'CONFIRMED' });

    await completeConsultationFixture(app, {
      doctorToken: fixture.token,
      appointmentId: appt.id,
      diagnosis: 'Seasonal allergy',
      doctorNotes: 'Advised antihistamines',
      treatmentPlan: 'Cetirizine 10mg once daily',
      followUpDate: '2026-09-01',
      vitals: { temperatureC: 37.1, pulseRate: 76 },
      prescriptionItems: [{ medicineName: 'Cetirizine', dosage: '10mg', frequency: 'Once daily', duration: '7 days' }],
    });

    const res = await request(app).get(`/api/v1/appointments/${appt.id}/visit-summary`).set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(200);
    const { summary } = res.body.data;
    expect(summary.consultation.diagnosis).toBe('Seasonal allergy');
    expect(summary.consultation.doctorNotes).toBe('Advised antihistamines');
    expect(summary.consultation.vitals.temperatureC).toBe(37.1);
    expect(summary.consultation.followUpDate).toContain('2026-09-01');
    expect(summary.prescription.items).toHaveLength(1);
    expect(summary.prescription.items[0].medicineName).toBe('Cetirizine');
    expect(summary.prescription.pdfUrl).not.toBeNull();
  });

  it('returns a null prescription when none was issued', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'CONFIRMED' });

    await completeConsultationFixture(app, { doctorToken: fixture.token, appointmentId: appt.id, diagnosis: 'Routine checkup' });

    const res = await request(app).get(`/api/v1/appointments/${appt.id}/visit-summary`).set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.summary.prescription).toBeNull();
    expect(res.body.data.summary.consultation.diagnosis).toBe('Routine checkup');
  });

  it('rejects a visit summary request for an appointment that is not yet completed', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'CONFIRMED' });

    const res = await request(app).get(`/api/v1/appointments/${appt.id}/visit-summary`).set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(409);
  });

  it('a patient cannot view another patient\'s visit summary — 404, not 403 (IDOR-safe)', async () => {
    const fixture = await createDoctorFixture(app);
    const patientA = await createPatientFixture(app);
    const patientB = await createPatientFixture(app);
    const appt = await createAppointmentFixture({ patientId: patientA.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'CONFIRMED' });
    await completeConsultationFixture(app, { doctorToken: fixture.token, appointmentId: appt.id });

    const res = await request(app).get(`/api/v1/appointments/${appt.id}/visit-summary`).set('Authorization', `Bearer ${patientB.token}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 for a nonexistent appointment id', async () => {
    const patient = await createPatientFixture(app);
    const res = await request(app).get('/api/v1/appointments/00000000-0000-0000-0000-000000000000/visit-summary').set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(404);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/appointments/00000000-0000-0000-0000-000000000000/visit-summary');
    expect(res.status).toBe(401);
  });

  it('a doctor token cannot use the patient-only visit-summary endpoint', async () => {
    const fixture = await createDoctorFixture(app);
    const res = await request(app).get('/api/v1/appointments/00000000-0000-0000-0000-000000000000/visit-summary').set('Authorization', `Bearer ${fixture.token}`);
    expect(res.status).toBe(403);
  });
});
