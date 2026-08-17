import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { CLINIC_PERMISSIONS, UserRole } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

async function submitDoctorAndClinicReview(fixture: { doctorId: string; clinicId: string }) {
  const patient = await createPatientFixture(app);
  const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });
  const res = await request(app)
    .post('/api/v1/reviews')
    .set('Authorization', `Bearer ${patient.token}`)
    .send({ appointmentId: appt.id, doctorReview: { rating: 4, comment: 'Fine' }, clinicReview: { rating: 3, comment: 'Average' } });
  return { patient, appt, doctorReviewId: res.body.data.reviews[0].id as string, clinicReviewId: res.body.data.reviews[1].id as string };
}

describe('Clinic review moderation — access control', () => {
  it('reception does NOT get moderation privileges by default (no REVIEW_MODERATE grant)', async () => {
    const fixture = await createDoctorFixture(app);
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.APPOINTMENT_MANAGE, CLINIC_PERMISSIONS.REPORTS_VIEW]);
    const res = await request(app).get('/api/v1/clinic/reviews').query({ clinicId: fixture.clinicId }).set('Authorization', `Bearer ${staff.token}`);
    expect(res.status).toBe(403);
  });

  it('a doctor cannot access the clinic moderation queue', async () => {
    const fixture = await createDoctorFixture(app);
    const res = await request(app).get('/api/v1/clinic/reviews').query({ clinicId: fixture.clinicId }).set('Authorization', `Bearer ${fixture.token}`);
    expect(res.status).toBe(403);
  });

  it('a patient cannot access the clinic moderation queue', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const res = await request(app).get('/api/v1/clinic/reviews').query({ clinicId: fixture.clinicId }).set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(403);
  });

  it('CLINIC_ADMIN bypasses the permission check entirely', async () => {
    const fixture = await createDoctorFixture(app);
    const admin = await createReceptionFixture(app, fixture.clinicId, [], { role: UserRole.CLINIC_ADMIN });
    const res = await request(app).get('/api/v1/clinic/reviews').query({ clinicId: fixture.clinicId }).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
  });

  it('staff of clinic A cannot moderate a review belonging to clinic B', async () => {
    const fixtureA = await createDoctorFixture(app);
    const fixtureB = await createDoctorFixture(app);
    const { doctorReviewId } = await submitDoctorAndClinicReview(fixtureB);
    const staffA = await createReceptionFixture(app, fixtureA.clinicId, [CLINIC_PERMISSIONS.REVIEW_MODERATE]);

    const res = await request(app).patch(`/api/v1/clinic/reviews/${doctorReviewId}/status`).set('Authorization', `Bearer ${staffA.token}`).send({ status: 'HIDDEN' });
    expect(res.status).toBe(403);
  });
});

describe('Clinic review moderation — status transitions', () => {
  it('lists both doctor and clinic reviews for the clinic in one combined, paginated feed', async () => {
    const fixture = await createDoctorFixture(app);
    await submitDoctorAndClinicReview(fixture);
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.REVIEW_MODERATE]);

    const res = await request(app).get('/api/v1/clinic/reviews').query({ clinicId: fixture.clinicId }).set('Authorization', `Bearer ${staff.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    const types = res.body.data.items.map((r: { type: string }) => r.type).sort();
    expect(types).toEqual(['CLINIC', 'DOCTOR']);
  });

  it('filters the queue by status and by rating', async () => {
    const fixture = await createDoctorFixture(app);
    const { doctorReviewId } = await submitDoctorAndClinicReview(fixture);
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.REVIEW_MODERATE]);
    await request(app).patch(`/api/v1/clinic/reviews/${doctorReviewId}/status`).set('Authorization', `Bearer ${staff.token}`).send({ status: 'HIDDEN' });

    const hiddenRes = await request(app).get('/api/v1/clinic/reviews').query({ clinicId: fixture.clinicId, status: 'HIDDEN' }).set('Authorization', `Bearer ${staff.token}`);
    expect(hiddenRes.body.data.items).toHaveLength(1);
    expect(hiddenRes.body.data.items[0].id).toBe(doctorReviewId);

    const ratingRes = await request(app).get('/api/v1/clinic/reviews').query({ clinicId: fixture.clinicId, rating: 3 }).set('Authorization', `Bearer ${staff.token}`);
    expect(ratingRes.body.data.items).toHaveLength(1);
    expect(ratingRes.body.data.items[0].type).toBe('CLINIC');
  });

  it('GET /clinic/reviews/:id returns the detail for an authorized moderator', async () => {
    const fixture = await createDoctorFixture(app);
    const { doctorReviewId } = await submitDoctorAndClinicReview(fixture);
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.REVIEW_MODERATE]);
    const res = await request(app).get(`/api/v1/clinic/reviews/${doctorReviewId}`).set('Authorization', `Bearer ${staff.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.review.id).toBe(doctorReviewId);
    // No patient PII beyond the same public-safe authorName snapshot.
    expect(res.body.data.review).not.toHaveProperty('patientId');
  });

  it('hides a published review, excludes it from the public page, and republishing restores it', async () => {
    const fixture = await createDoctorFixture(app);
    const { doctorReviewId } = await submitDoctorAndClinicReview(fixture);
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.REVIEW_MODERATE]);

    const hideRes = await request(app).patch(`/api/v1/clinic/reviews/${doctorReviewId}/status`).set('Authorization', `Bearer ${staff.token}`).send({ status: 'HIDDEN', reason: 'Inappropriate language' });
    expect(hideRes.status).toBe(200);
    let review = await prisma.doctorReview.findUniqueOrThrow({ where: { id: doctorReviewId } });
    expect(review.status).toBe('HIDDEN');
    expect(review.moderationReason).toBe('Inappropriate language');
    expect(review.moderatedByUserId).toBe(staff.userId);

    const republishRes = await request(app).patch(`/api/v1/clinic/reviews/${doctorReviewId}/status`).set('Authorization', `Bearer ${staff.token}`).send({ status: 'PUBLISHED' });
    expect(republishRes.status).toBe(200);
    review = await prisma.doctorReview.findUniqueOrThrow({ where: { id: doctorReviewId } });
    expect(review.status).toBe('PUBLISHED');
  });

  it('rejects an invalid status value', async () => {
    const fixture = await createDoctorFixture(app);
    const { doctorReviewId } = await submitDoctorAndClinicReview(fixture);
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.REVIEW_MODERATE]);
    const res = await request(app).patch(`/api/v1/clinic/reviews/${doctorReviewId}/status`).set('Authorization', `Bearer ${staff.token}`).send({ status: 'DELETED' });
    expect(res.status).toBe(400);
  });
});

describe('Clinic response to a clinic review', () => {
  it('lets an authorized staff member respond exactly once', async () => {
    const fixture = await createDoctorFixture(app);
    const { clinicReviewId } = await submitDoctorAndClinicReview(fixture);
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.REVIEW_MODERATE]);

    const res = await request(app).post(`/api/v1/clinic/reviews/${clinicReviewId}/respond`).set('Authorization', `Bearer ${staff.token}`).send({ response: 'Thanks for the feedback!' });
    expect(res.status).toBe(200);
    expect(res.body.data.review.response).toBe('Thanks for the feedback!');

    const second = await request(app).post(`/api/v1/clinic/reviews/${clinicReviewId}/respond`).set('Authorization', `Bearer ${staff.token}`).send({ response: 'Again' });
    expect(second.status).toBe(409);
  });

  it('a patient cannot impersonate a provider response', async () => {
    const fixture = await createDoctorFixture(app);
    const { clinicReviewId, patient } = await submitDoctorAndClinicReview(fixture);
    const res = await request(app).post(`/api/v1/clinic/reviews/${clinicReviewId}/respond`).set('Authorization', `Bearer ${patient.token}`).send({ response: 'Fake response' });
    expect(res.status).toBe(403);
  });
});
