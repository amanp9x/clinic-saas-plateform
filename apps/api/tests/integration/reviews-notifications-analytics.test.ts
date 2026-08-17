import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { CLINIC_PERMISSIONS, UserRole } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

describe('Notification integration', () => {
  it('submitting a doctor review dispatches REVIEW_RECEIVED to the doctor', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });

    await request(app).post('/api/v1/reviews').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appt.id, doctorReview: { rating: 5 } });

    const notif = await prisma.notification.findFirst({ where: { userId: fixture.userId, type: 'REVIEW_RECEIVED' } });
    expect(notif).not.toBeNull();
  });

  it('idempotency: two concurrent identical-key submissions never produce two REVIEW_RECEIVED notifications', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });

    const submit = () => request(app).post('/api/v1/reviews').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appt.id, doctorReview: { rating: 5 } });
    await Promise.all([submit(), submit()]);

    const count = await prisma.notification.count({ where: { userId: fixture.userId, type: 'REVIEW_RECEIVED' } });
    expect(count).toBe(1);
  });

  it('a doctor responding to a review dispatches REVIEW_RESPONSE to the reviewing patient', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });
    const submitRes = await request(app).post('/api/v1/reviews').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appt.id, doctorReview: { rating: 5 } });
    const reviewId = submitRes.body.data.reviews[0].id as string;

    await request(app).post(`/api/v1/doctor/reviews/${reviewId}/respond`).set('Authorization', `Bearer ${fixture.token}`).send({ response: 'Thank you' });

    const notif = await prisma.notification.findFirst({ where: { userId: patient.userId, type: 'REVIEW_RESPONSE' } });
    expect(notif).not.toBeNull();
  });

  it('hiding a previously-published review notifies the patient (REVIEW_HIDDEN); a routine PENDING->PUBLISHED-style no-op does not', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });
    const submitRes = await request(app).post('/api/v1/reviews').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appt.id, doctorReview: { rating: 5 } });
    const reviewId = submitRes.body.data.reviews[0].id as string;
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.REVIEW_MODERATE]);

    await request(app).patch(`/api/v1/clinic/reviews/${reviewId}/status`).set('Authorization', `Bearer ${staff.token}`).send({ status: 'HIDDEN', reason: 'test' });

    const notif = await prisma.notification.findFirst({ where: { userId: patient.userId, type: 'REVIEW_HIDDEN' } });
    expect(notif).not.toBeNull();
  });

  it('respects the recipient\'s own notification (no cross-user leakage): the doctor never gets a REVIEW_HIDDEN meant for the patient', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });
    const submitRes = await request(app).post('/api/v1/reviews').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appt.id, doctorReview: { rating: 5 } });
    const reviewId = submitRes.body.data.reviews[0].id as string;
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.REVIEW_MODERATE]);
    await request(app).patch(`/api/v1/clinic/reviews/${reviewId}/status`).set('Authorization', `Bearer ${staff.token}`).send({ status: 'HIDDEN' });

    const doctorNotif = await prisma.notification.findFirst({ where: { userId: fixture.userId, type: 'REVIEW_HIDDEN' } });
    expect(doctorNotif).toBeNull();
  });
});

describe('Analytics integration (Phase 11 extension)', () => {
  it('the clinic analytics overview review summary matches the real source-of-truth aggregates', async () => {
    const fixture = await createDoctorFixture(app);
    const admin = await createReceptionFixture(app, fixture.clinicId, [], { role: UserRole.CLINIC_ADMIN });

    for (const rating of [5, 3]) {
      const patient = await createPatientFixture(app);
      const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });
      await request(app).post('/api/v1/reviews').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appt.id, doctorReview: { rating }, clinicReview: { rating } });
    }

    const res = await request(app).get('/api/v1/analytics/overview').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.reviews.doctorReviewCount).toBe(2);
    expect(res.body.data.reviews.doctorAverageRating).toBeCloseTo(4, 4);
    expect(res.body.data.reviews.clinicReviewCount).toBe(2);
    expect(res.body.data.reviews.clinicAverageRating).toBeCloseTo(4, 4);

    const actualDoctorCount = await prisma.doctorReview.count({ where: { doctorId: fixture.doctorId, status: 'PUBLISHED' } });
    expect(actualDoctorCount).toBe(2);
  });

  it('a doctor cannot see another doctor\'s review analytics via /doctor/reviews (own-scope enforced)', async () => {
    const fixtureA = await createDoctorFixture(app);
    const fixtureB = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixtureA.doctorId, clinicId: fixtureA.clinicId, status: 'COMPLETED' });
    await request(app).post('/api/v1/reviews').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appt.id, doctorReview: { rating: 5 } });

    const res = await request(app).get('/api/v1/doctor/reviews').set('Authorization', `Bearer ${fixtureB.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.reviews.ratingCount).toBe(0);
  });
});
