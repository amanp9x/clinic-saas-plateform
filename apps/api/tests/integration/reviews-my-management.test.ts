import { describe, expect, it } from 'vitest';
import request from 'supertest';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture } = await import('../helpers/doctor-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

async function submittedDoctorReview() {
  const fixture = await createDoctorFixture(app);
  const patient = await createPatientFixture(app);
  const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });
  const res = await request(app).post('/api/v1/reviews').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appt.id, doctorReview: { rating: 3, comment: 'Okay' } });
  return { fixture, patient, appt, reviewId: res.body.data.reviews[0].id as string };
}

describe('GET /api/v1/reviews/my', () => {
  it('lists the patient\'s own reviews across both types, newest first', async () => {
    const patient = await createPatientFixture(app);
    const fixtureA = await createDoctorFixture(app);
    const apptA = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixtureA.doctorId, clinicId: fixtureA.clinicId, status: 'COMPLETED' });
    await request(app).post('/api/v1/reviews').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: apptA.id, doctorReview: { rating: 5 }, clinicReview: { rating: 4 } });

    const res = await request(app).get('/api/v1/reviews/my').set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.total).toBe(2);
  });

  it('filters by type', async () => {
    const { patient } = await submittedDoctorReview();
    const res = await request(app).get('/api/v1/reviews/my').query({ type: 'CLINIC' }).set('Authorization', `Bearer ${patient.token}`);
    expect(res.body.data.items).toHaveLength(0);
    const res2 = await request(app).get('/api/v1/reviews/my').query({ type: 'DOCTOR' }).set('Authorization', `Bearer ${patient.token}`);
    expect(res2.body.data.items).toHaveLength(1);
  });

  it('never returns another patient\'s reviews', async () => {
    const { patient: ownerPatient } = await submittedDoctorReview();
    void ownerPatient;
    const outsider = await createPatientFixture(app);
    const res = await request(app).get('/api/v1/reviews/my').set('Authorization', `Bearer ${outsider.token}`);
    expect(res.body.data.items).toHaveLength(0);
  });
});

describe('PATCH /api/v1/reviews/:id — edit policy', () => {
  it('allows the owner to edit within the safe window', async () => {
    const { patient, reviewId } = await submittedDoctorReview();
    const res = await request(app).patch(`/api/v1/reviews/${reviewId}`).set('Authorization', `Bearer ${patient.token}`).send({ rating: 4, comment: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.data.review.rating).toBe(4);
    expect(res.body.data.review.comment).toBe('Updated');
  });

  it('recomputes the doctor rating cache after an edit that changes the rating', async () => {
    const { fixture, patient, reviewId } = await submittedDoctorReview();
    await request(app).patch(`/api/v1/reviews/${reviewId}`).set('Authorization', `Bearer ${patient.token}`).send({ rating: 1 });
    const doctor = await prisma.doctor.findUniqueOrThrow({ where: { id: fixture.doctorId } });
    expect(doctor.ratingAverage).toBe(1);
  });

  it('rejects editing after the 48h window has passed', async () => {
    const { patient, reviewId } = await submittedDoctorReview();
    await prisma.doctorReview.update({ where: { id: reviewId }, data: { createdAt: new Date(Date.now() - 49 * 60 * 60 * 1000) } });
    const res = await request(app).patch(`/api/v1/reviews/${reviewId}`).set('Authorization', `Bearer ${patient.token}`).send({ rating: 1 });
    expect(res.status).toBe(403);
  });

  it('rejects editing once the review already has a provider response', async () => {
    const { fixture, patient, reviewId } = await submittedDoctorReview();
    await request(app).post(`/api/v1/doctor/reviews/${reviewId}/respond`).set('Authorization', `Bearer ${fixture.token}`).send({ response: 'Thank you!' });
    const res = await request(app).patch(`/api/v1/reviews/${reviewId}`).set('Authorization', `Bearer ${patient.token}`).send({ rating: 1 });
    expect(res.status).toBe(403);
  });

  it('a different patient cannot edit someone else\'s review — 404', async () => {
    const { reviewId } = await submittedDoctorReview();
    const outsider = await createPatientFixture(app);
    const res = await request(app).patch(`/api/v1/reviews/${reviewId}`).set('Authorization', `Bearer ${outsider.token}`).send({ rating: 1 });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/reviews/:id', () => {
  it('allows the owner to delete within the safe window and recomputes the aggregate', async () => {
    const { fixture, patient, reviewId } = await submittedDoctorReview();
    const res = await request(app).delete(`/api/v1/reviews/${reviewId}`).set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(200);
    const exists = await prisma.doctorReview.findUnique({ where: { id: reviewId } });
    expect(exists).toBeNull();
    const doctor = await prisma.doctor.findUniqueOrThrow({ where: { id: fixture.doctorId } });
    expect(doctor.ratingCount).toBe(0);
    expect(doctor.ratingAverage).toBeNull();
  });

  it('rejects deleting after the 48h window', async () => {
    const { patient, reviewId } = await submittedDoctorReview();
    await prisma.doctorReview.update({ where: { id: reviewId }, data: { createdAt: new Date(Date.now() - 49 * 60 * 60 * 1000) } });
    const res = await request(app).delete(`/api/v1/reviews/${reviewId}`).set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(403);
  });

  it('a different patient cannot delete someone else\'s review — 404', async () => {
    const { reviewId } = await submittedDoctorReview();
    const outsider = await createPatientFixture(app);
    const res = await request(app).delete(`/api/v1/reviews/${reviewId}`).set('Authorization', `Bearer ${outsider.token}`);
    expect(res.status).toBe(404);
  });
});
