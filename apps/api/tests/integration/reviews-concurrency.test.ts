import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { CLINIC_PERMISSIONS } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

describe('MANDATORY: simultaneous review submissions cannot create duplicates', () => {
  it('two concurrent POST /reviews for the same appointment produce exactly one DoctorReview row', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });

    const submit = () => request(app).post('/api/v1/reviews').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appt.id, doctorReview: { rating: 5 } });
    const [r1, r2] = await Promise.all([submit(), submit()]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const count = await prisma.doctorReview.count({ where: { appointmentId: appt.id } });
    expect(count).toBe(1);

    const doctor = await prisma.doctor.findUniqueOrThrow({ where: { id: fixture.doctorId } });
    expect(doctor.ratingCount).toBe(1);
  });

  it('the same guarantee holds for ClinicReview', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });

    const submit = () => request(app).post('/api/v1/reviews').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appt.id, clinicReview: { rating: 3 } });
    const [r1, r2] = await Promise.all([submit(), submit()]);

    expect([r1.status, r2.status].sort()).toEqual([201, 409]);
    const count = await prisma.clinicReview.count({ where: { appointmentId: appt.id } });
    expect(count).toBe(1);
  });
});

describe('MANDATORY: simultaneous moderation operations produce one authoritative final state', () => {
  it('two concurrent status updates on the same review converge on a single, consistent final row', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });
    const submitRes = await request(app).post('/api/v1/reviews').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appt.id, doctorReview: { rating: 4 } });
    const reviewId = submitRes.body.data.reviews[0].id as string;
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.REVIEW_MODERATE]);

    const [moderateA, moderateB] = await Promise.all([
      request(app).patch(`/api/v1/clinic/reviews/${reviewId}/status`).set('Authorization', `Bearer ${staff.token}`).send({ status: 'HIDDEN', reason: 'race A' }),
      request(app).patch(`/api/v1/clinic/reviews/${reviewId}/status`).set('Authorization', `Bearer ${staff.token}`).send({ status: 'REJECTED', reason: 'race B' }),
    ]);
    // Both requests are individually valid moderation actions (no ownership/permission conflict),
    // so both succeed at the HTTP layer — the DB row itself must still land on exactly ONE final
    // status (whichever update's UPDATE statement committed last), never a torn/ambiguous state.
    expect(moderateA.status).toBe(200);
    expect(moderateB.status).toBe(200);

    const finalReview = await prisma.doctorReview.findUniqueOrThrow({ where: { id: reviewId } });
    expect(['HIDDEN', 'REJECTED']).toContain(finalReview.status);
    // Only one row exists — no duplication from the race.
    const totalRows = await prisma.doctorReview.count({ where: { id: reviewId } });
    expect(totalRows).toBe(1);

    // The doctor's cached aggregate reflects reality post-race: this review is no longer
    // PUBLISHED, so it must not count toward ratingCount.
    const doctor = await prisma.doctor.findUniqueOrThrow({ where: { id: fixture.doctorId } });
    expect(doctor.ratingCount).toBe(0);
  });
});

describe('MANDATORY: aggregate results remain correct under concurrent submissions', () => {
  it('N concurrent reviews from different patients all land, and the final average/count is exactly right', async () => {
    const fixture = await createDoctorFixture(app);
    const ratings = [5, 4, 3, 2, 1];
    const submissions = await Promise.all(
      ratings.map(async (rating) => {
        const patient = await createPatientFixture(app);
        const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });
        return { patient, appt, rating };
      }),
    );

    const results = await Promise.all(
      submissions.map(({ patient, appt, rating }) =>
        request(app).post('/api/v1/reviews').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appt.id, doctorReview: { rating } }),
      ),
    );
    expect(results.every((r) => r.status === 201)).toBe(true);

    const doctor = await prisma.doctor.findUniqueOrThrow({ where: { id: fixture.doctorId } });
    expect(doctor.ratingCount).toBe(5);
    expect(doctor.ratingAverage).toBeCloseTo((5 + 4 + 3 + 2 + 1) / 5, 4);

    const actualCount = await prisma.doctorReview.count({ where: { doctorId: fixture.doctorId, status: 'PUBLISHED' } });
    expect(actualCount).toBe(5);
  });
});
