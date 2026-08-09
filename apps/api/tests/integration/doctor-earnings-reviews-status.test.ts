import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

const { createApp } = await import('../../src/app.js');
const { prisma } = await import('../../src/config/database.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture, todayAt } = await import(
  '../helpers/doctor-fixtures.js'
);

const app = createApp();

let doctor: Awaited<ReturnType<typeof createDoctorFixture>>;
let otherDoctor: Awaited<ReturnType<typeof createDoctorFixture>>;

beforeAll(async () => {
  doctor = await createDoctorFixture(app);
  otherDoctor = await createDoctorFixture(app);
});

describe('Earnings aggregation', () => {
  it("computes today's earnings from completed appointments with the 10% platform commission", async () => {
    const patient = await createPatientFixture(app);
    await createAppointmentFixture({
      patientId: patient.patientId,
      doctorId: doctor.doctorId,
      clinicId: doctor.clinicId,
      status: 'COMPLETED',
      scheduledAt: todayAt(10, 0),
      consultationFee: 800,
    });
    await prisma.appointment.updateMany({
      where: { doctorId: doctor.doctorId, status: 'COMPLETED' },
      data: { completedAt: new Date() },
    });

    const res = await request(app)
      .get('/api/v1/doctor/earnings?range=today')
      .set('Authorization', `Bearer ${doctor.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.earnings.totalEarnings).toBe('800.00');
    expect(res.body.data.earnings.completedConsultations).toBe(1);
    expect(res.body.data.earnings.platformCommissionPercent).toBe(10);
    expect(res.body.data.earnings.platformCommissionAmount).toBe('80.00');
    expect(res.body.data.earnings.netEarnings).toBe('720.00');
  });

  it('an unrelated doctor sees zero earnings for the same range', async () => {
    const res = await request(app)
      .get('/api/v1/doctor/earnings?range=today')
      .set('Authorization', `Bearer ${otherDoctor.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.earnings.totalEarnings).toBe('0.00');
  });
});

describe('Reviews', () => {
  it('lets a doctor respond to their own review exactly once', async () => {
    const review = await prisma.doctorReview.create({
      data: { doctorId: doctor.doctorId, authorName: 'A Patient', rating: 5, comment: 'Great doctor!' },
    });

    const respondRes = await request(app)
      .post(`/api/v1/doctor/reviews/${review.id}/respond`)
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ response: 'Thank you for the kind words!' });
    expect(respondRes.status).toBe(200);
    expect(respondRes.body.data.review.response).toBe('Thank you for the kind words!');

    const secondRespondRes = await request(app)
      .post(`/api/v1/doctor/reviews/${review.id}/respond`)
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ response: 'Trying again' });
    expect(secondRespondRes.status).toBe(400);
  });

  it("returns 404 (not 403) when a doctor tries to respond to another doctor's review", async () => {
    const review = await prisma.doctorReview.create({
      data: { doctorId: doctor.doctorId, authorName: 'Another Patient', rating: 4, comment: 'Good visit' },
    });

    const res = await request(app)
      .post(`/api/v1/doctor/reviews/${review.id}/respond`)
      .set('Authorization', `Bearer ${otherDoctor.token}`)
      .send({ response: 'Not mine to answer' });
    expect(res.status).toBe(404);
  });

  it('lists reviews with a rating breakdown', async () => {
    const res = await request(app)
      .get('/api/v1/doctor/reviews')
      .set('Authorization', `Bearer ${doctor.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.reviews.breakdown).toHaveLength(5);
    expect(res.body.data.reviews.recentReviews.length).toBeGreaterThanOrEqual(2);
  });
});

describe('Doctor live status', () => {
  it('sets and reads back a manual status for a clinic', async () => {
    const patchRes = await request(app)
      .patch('/api/v1/doctor/status')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ clinicId: doctor.clinicId, status: 'ON_BREAK' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.session.status).toBe('ON_BREAK');

    const getRes = await request(app)
      .get('/api/v1/doctor/status')
      .set('Authorization', `Bearer ${doctor.token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.sessions.find((s: { clinicId: string }) => s.clinicId === doctor.clinicId)?.status).toBe(
      'ON_BREAK',
    );
  });

  it('rejects a system-only status value (IN_CONSULTATION)', async () => {
    const res = await request(app)
      .patch('/api/v1/doctor/status')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ clinicId: doctor.clinicId, status: 'IN_CONSULTATION' });
    expect(res.status).toBe(400);
  });

  it('rejects setting status for a clinic the doctor is not associated with', async () => {
    const res = await request(app)
      .patch('/api/v1/doctor/status')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ clinicId: otherDoctor.clinicId, status: 'AVAILABLE' });
    expect(res.status).toBe(403);
  });
});
