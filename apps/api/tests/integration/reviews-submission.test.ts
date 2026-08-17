import { describe, expect, it } from 'vitest';
import request from 'supertest';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture } = await import('../helpers/doctor-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

async function completedAppointment() {
  const fixture = await createDoctorFixture(app);
  const patient = await createPatientFixture(app);
  const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });
  return { fixture, patient, appt };
}

describe('POST /api/v1/reviews', () => {
  it('submits a doctor review with dimensions and recomputes Doctor.ratingAverage/ratingCount', async () => {
    const { fixture, patient, appt } = await completedAppointment();
    const res = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ appointmentId: appt.id, doctorReview: { rating: 5, communication: 5, professionalism: 4, consultationExperience: 5, explanationClarity: 4, comment: 'Great doctor' } });
    expect(res.status).toBe(201);
    expect(res.body.data.reviews).toHaveLength(1);
    expect(res.body.data.reviews[0].type).toBe('DOCTOR');
    expect(res.body.data.reviews[0].status).toBe('PUBLISHED');

    const doctor = await prisma.doctor.findUniqueOrThrow({ where: { id: fixture.doctorId } });
    expect(doctor.ratingAverage).toBe(5);
    expect(doctor.ratingCount).toBe(1);
  });

  it('submits a clinic review with dimensions and recomputes Clinic.ratingAverage/ratingCount', async () => {
    const { fixture, patient, appt } = await completedAppointment();
    const res = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ appointmentId: appt.id, clinicReview: { rating: 4, cleanliness: 4, staffExperience: 5, waitingExperience: 3, overallExperience: 4 } });
    expect(res.status).toBe(201);
    expect(res.body.data.reviews[0].type).toBe('CLINIC');

    const clinic = await prisma.clinic.findUniqueOrThrow({ where: { id: fixture.clinicId } });
    expect(clinic.ratingAverage).toBe(4);
    expect(clinic.ratingCount).toBe(1);
  });

  it('submits doctor and clinic reviews together in a single call', async () => {
    const { patient, appt } = await completedAppointment();
    const res = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ appointmentId: appt.id, doctorReview: { rating: 5 }, clinicReview: { rating: 3 } });
    expect(res.status).toBe(201);
    expect(res.body.data.reviews).toHaveLength(2);
  });

  it('rejects a rating outside 1-5', async () => {
    const { patient, appt } = await completedAppointment();
    const res = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ appointmentId: appt.id, doctorReview: { rating: 6 } });
    expect(res.status).toBe(400);
  });

  it('rejects a request with neither doctorReview nor clinicReview', async () => {
    const { patient, appt } = await completedAppointment();
    const res = await request(app).post('/api/v1/reviews').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appt.id });
    expect(res.status).toBe(400);
  });

  it('does not force a written comment — rating alone is a valid submission', async () => {
    const { patient, appt } = await completedAppointment();
    const res = await request(app).post('/api/v1/reviews').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appt.id, doctorReview: { rating: 3 } });
    expect(res.status).toBe(201);
    expect(res.body.data.reviews[0].comment).toBeNull();
  });

  it('rejects submitting for a non-completed appointment', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'CANCELLED' });
    const res = await request(app).post('/api/v1/reviews').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appt.id, doctorReview: { rating: 5 } });
    expect(res.status).toBe(409);
  });

  it('rejects a duplicate doctor review for the same appointment (DB-level unique constraint)', async () => {
    const { patient, appt } = await completedAppointment();
    const first = await request(app).post('/api/v1/reviews').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appt.id, doctorReview: { rating: 5 } });
    expect(first.status).toBe(201);

    const second = await request(app).post('/api/v1/reviews').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appt.id, doctorReview: { rating: 2 } });
    expect(second.status).toBe(409);

    const count = await prisma.doctorReview.count({ where: { appointmentId: appt.id } });
    expect(count).toBe(1);
  });

  it('a patient cannot submit a review for another patient\'s appointment — 404, not 403', async () => {
    const fixture = await createDoctorFixture(app);
    const owner = await createPatientFixture(app);
    const outsider = await createPatientFixture(app);
    const appt = await createAppointmentFixture({ patientId: owner.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });

    const res = await request(app).post('/api/v1/reviews').set('Authorization', `Bearer ${outsider.token}`).send({ appointmentId: appt.id, doctorReview: { rating: 5 } });
    expect(res.status).toBe(404);
  });
});
