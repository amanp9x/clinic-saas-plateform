import { describe, expect, it } from 'vitest';
import request from 'supertest';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

async function publishedDoctorReview(rating = 5) {
  const fixture = await createDoctorFixture(app);
  const patient = await createPatientFixture(app);
  const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });
  const res = await request(app).post('/api/v1/reviews').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appt.id, doctorReview: { rating } });
  return { fixture, patient, appt, reviewId: res.body.data.reviews[0].id as string };
}

describe('Public review visibility', () => {
  it('a doctor detail page only shows PUBLISHED reviews, never PENDING/HIDDEN/REJECTED', async () => {
    const { fixture, reviewId } = await publishedDoctorReview();
    await prisma.doctorReview.update({ where: { id: reviewId }, data: { status: 'HIDDEN' } });

    const doctor = await prisma.doctor.findUniqueOrThrow({ where: { id: fixture.doctorId } });
    const detailRes = await request(app).get(`/api/v1/catalog/doctors/${doctor.slug}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.doctor.reviews).toHaveLength(0);
  });

  it('the public doctor reviews list endpoint only returns PUBLISHED rows', async () => {
    const { fixture } = await publishedDoctorReview(5);
    const doctor = await prisma.doctor.findUniqueOrThrow({ where: { id: fixture.doctorId } });
    const patient2 = await createPatientFixture(app);
    const appt2 = await createAppointmentFixture({ patientId: patient2.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });
    const secondReview = await request(app).post('/api/v1/reviews').set('Authorization', `Bearer ${patient2.token}`).send({ appointmentId: appt2.id, doctorReview: { rating: 1 } });
    await prisma.doctorReview.update({ where: { id: secondReview.body.data.reviews[0].id }, data: { status: 'REJECTED' } });

    const res = await request(app).get(`/api/v1/catalog/doctors/${doctor.slug}/reviews`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.total).toBe(1);
  });

  it('never exposes patientId, email, or phone in a public review payload', async () => {
    const { fixture, patient } = await publishedDoctorReview();
    const doctor = await prisma.doctor.findUniqueOrThrow({ where: { id: fixture.doctorId } });
    const res = await request(app).get(`/api/v1/catalog/doctors/${doctor.slug}/reviews`);
    const body = JSON.stringify(res.body.data);
    expect(body).not.toContain(patient.userId);
    expect(body.toLowerCase()).not.toMatch(/@example\.com/);
    expect(body).not.toMatch(/patientId/i);
  });

  it('rating aggregate and distribution match only PUBLISHED reviews', async () => {
    const fixture = await createDoctorFixture(app);
    const doctor = await prisma.doctor.findUniqueOrThrow({ where: { id: fixture.doctorId } });

    for (const rating of [5, 5, 3]) {
      const patient = await createPatientFixture(app);
      const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });
      await request(app).post('/api/v1/reviews').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appt.id, doctorReview: { rating } });
    }
    // A 4th review that gets rejected via the real moderation endpoint (not a raw DB status hack)
    // — must not affect the aggregate. Going through the endpoint also exercises the
    // rating-recompute side effect the raw-hack shortcut used elsewhere in this file bypasses.
    const { CLINIC_PERMISSIONS } = await import('@clinic/shared');
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.REVIEW_MODERATE]);
    const rejectedPatient = await createPatientFixture(app);
    const rejectedAppt = await createAppointmentFixture({ patientId: rejectedPatient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });
    const rejectedRes = await request(app).post('/api/v1/reviews').set('Authorization', `Bearer ${rejectedPatient.token}`).send({ appointmentId: rejectedAppt.id, doctorReview: { rating: 1 } });
    const moderateRes = await request(app)
      .patch(`/api/v1/clinic/reviews/${rejectedRes.body.data.reviews[0].id}/status`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ status: 'REJECTED', reason: 'Spam' });
    expect(moderateRes.status).toBe(200);

    const detailRes = await request(app).get(`/api/v1/catalog/doctors/${doctor.slug}`);
    expect(detailRes.body.data.doctor.ratingBreakdown.count).toBe(3);
    expect(detailRes.body.data.doctor.ratingBreakdown.average).toBeCloseTo((5 + 5 + 3) / 3, 4);
    const dist = detailRes.body.data.doctor.ratingBreakdown.distribution as { rating: number; count: number }[];
    expect(dist.find((d) => d.rating === 5)?.count).toBe(2);
    expect(dist.find((d) => d.rating === 3)?.count).toBe(1);
    expect(dist.find((d) => d.rating === 1)?.count).toBe(0);
  });

  it('the clinic detail page shows only PUBLISHED clinic reviews and a correct rating breakdown', async () => {
    const fixture = await createDoctorFixture(app);
    const clinic = await prisma.clinic.findUniqueOrThrow({ where: { id: fixture.clinicId } });
    const patient = await createPatientFixture(app);
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });
    await request(app).post('/api/v1/reviews').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appt.id, clinicReview: { rating: 4 } });

    const res = await request(app).get(`/api/v1/catalog/clinics/${clinic.slug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.reviews).toHaveLength(1);
    expect(res.body.data.ratingAverage).toBe(4);
    expect(res.body.data.ratingCount).toBe(1);
  });

  it('a foreign clinic\'s moderation queue never leaks into another clinic\'s view', async () => {
    const { CLINIC_PERMISSIONS } = await import('@clinic/shared');
    const fixtureA = await createDoctorFixture(app);
    const fixtureB = await createDoctorFixture(app);
    await publishedDoctorReviewFor(fixtureA);
    const staffB = await createReceptionFixture(app, fixtureB.clinicId, [CLINIC_PERMISSIONS.REVIEW_MODERATE]);

    const res = await request(app).get('/api/v1/clinic/reviews').query({ clinicId: fixtureB.clinicId }).set('Authorization', `Bearer ${staffB.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });
});

async function publishedDoctorReviewFor(fixture: { doctorId: string; clinicId: string }) {
  const patient = await createPatientFixture(app);
  const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });
  return request(app).post('/api/v1/reviews').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appt.id, doctorReview: { rating: 5 } });
}
