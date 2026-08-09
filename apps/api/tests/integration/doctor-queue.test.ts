import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture, todayAt } = await import(
  '../helpers/doctor-fixtures.js'
);

const app = createApp();

let doctor: Awaited<ReturnType<typeof createDoctorFixture>>;
let authorizedDoctor: Awaited<ReturnType<typeof createDoctorFixture>>;

beforeAll(async () => {
  doctor = await createDoctorFixture(app);
  authorizedDoctor = await createDoctorFixture(app, { canOverrideDelay: true });
});

describe('Queue session lifecycle', () => {
  it('starting a session pulls in unqueued confirmed appointments as waiting tokens', async () => {
    const patientA = await createPatientFixture(app);
    const patientB = await createPatientFixture(app);
    await createAppointmentFixture({
      patientId: patientA.patientId,
      doctorId: doctor.doctorId,
      clinicId: doctor.clinicId,
      status: 'CONFIRMED',
      scheduledAt: todayAt(9, 0),
    });
    await createAppointmentFixture({
      patientId: patientB.patientId,
      doctorId: doctor.doctorId,
      clinicId: doctor.clinicId,
      status: 'CONFIRMED',
      scheduledAt: todayAt(9, 15),
    });

    const startRes = await request(app)
      .post('/api/v1/doctor/queue/session/start')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ clinicId: doctor.clinicId });
    expect(startRes.status).toBe(200);
    expect(startRes.body.data.queue.session.queueStatus).toBe('ACTIVE');
    expect(startRes.body.data.queue.waitingTokens.length).toBeGreaterThanOrEqual(2);
    expect(startRes.body.data.queue.waitingTokens[0].tokenNumber).toBeLessThan(
      startRes.body.data.queue.waitingTokens[1].tokenNumber,
    );

    const restartRes = await request(app)
      .post('/api/v1/doctor/queue/session/start')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ clinicId: doctor.clinicId });
    expect(restartRes.status).toBe(409);
  });

  it('pauses and resumes the queue', async () => {
    const pauseRes = await request(app)
      .post('/api/v1/doctor/queue/session/pause')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ clinicId: doctor.clinicId });
    expect(pauseRes.status).toBe(200);
    expect(pauseRes.body.data.queue.session.queueStatus).toBe('PAUSED');

    const callWhilePausedRes = await request(app)
      .post('/api/v1/doctor/queue/call-next')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ clinicId: doctor.clinicId });
    expect(callWhilePausedRes.status).toBe(409);

    const resumeRes = await request(app)
      .post('/api/v1/doctor/queue/session/resume')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ clinicId: doctor.clinicId });
    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body.data.queue.session.queueStatus).toBe('ACTIVE');
  });

  it('calls the next patient in tokenNumber order, then supports repeat-call', async () => {
    const callRes = await request(app)
      .post('/api/v1/doctor/queue/call-next')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ clinicId: doctor.clinicId });
    expect(callRes.status).toBe(200);
    expect(callRes.body.data.queue.currentToken.status).toBe('CALLED');
    const tokenId = callRes.body.data.queue.currentToken.id;

    const repeatRes = await request(app)
      .post('/api/v1/doctor/queue/repeat-call')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ clinicId: doctor.clinicId, tokenId });
    expect(repeatRes.status).toBe(200);
    expect(repeatRes.body.data.queue.currentToken.calledCount).toBeGreaterThanOrEqual(2);
  });

  it('skips the next waiting patient with a reason', async () => {
    const snapshotRes = await request(app)
      .get(`/api/v1/doctor/queue?clinicId=${doctor.clinicId}`)
      .set('Authorization', `Bearer ${doctor.token}`);
    const waitingToken = snapshotRes.body.data.queue.waitingTokens[0];
    expect(waitingToken).toBeDefined();

    const skipRes = await request(app)
      .post('/api/v1/doctor/queue/skip')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ clinicId: doctor.clinicId, tokenId: waitingToken.id, reason: 'Not present' });
    expect(skipRes.status).toBe(200);
    expect(skipRes.body.data.queue.skippedTodayCount).toBeGreaterThanOrEqual(1);
  });

  it('isolates queues across clinics — a doctor cannot control another clinic queue', async () => {
    const res = await request(app)
      .post('/api/v1/doctor/queue/call-next')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ clinicId: authorizedDoctor.clinicId });
    expect(res.status).toBe(403);
  });
});

describe('Delay authorization', () => {
  it('forbids delay updates for a doctor without canOverrideDelay', async () => {
    const res = await request(app)
      .patch('/api/v1/doctor/queue/delay')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ clinicId: doctor.clinicId, delayMinutes: 15, delayReason: 'Running behind' });
    expect(res.status).toBe(403);
  });

  it('allows delay updates for a doctor with canOverrideDelay', async () => {
    await request(app)
      .post('/api/v1/doctor/queue/session/start')
      .set('Authorization', `Bearer ${authorizedDoctor.token}`)
      .send({ clinicId: authorizedDoctor.clinicId });

    const res = await request(app)
      .patch('/api/v1/doctor/queue/delay')
      .set('Authorization', `Bearer ${authorizedDoctor.token}`)
      .send({ clinicId: authorizedDoctor.clinicId, delayMinutes: 10, delayReason: 'Emergency case' });
    expect(res.status).toBe(200);
    expect(res.body.data.queue.session.delayMinutes).toBe(10);
  });
});
