import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ALL_CLINIC_PERMISSIONS, CLINIC_PERMISSIONS } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

async function checkInNewPatient(clinicId: string, doctorId: string, token: string) {
  const patient = await createPatientFixture(app);
  const appointment = await createAppointmentFixture({ patientId: patient.patientId, doctorId, clinicId, status: 'CONFIRMED' });
  const res = await request(app).post('/api/v1/reception/checkin').set('Authorization', `Bearer ${token}`).send({ appointmentId: appointment.id });
  if (res.status !== 200) throw new Error(`check-in fixture failed: ${JSON.stringify(res.body)}`);
  return { patient, appointment, token: res.body.data.token };
}

let doctor: Awaited<ReturnType<typeof createDoctorFixture>>;
let reception: Awaited<ReturnType<typeof createReceptionFixture>>;

beforeAll(async () => {
  doctor = await createDoctorFixture(app);
  reception = await createReceptionFixture(app, doctor.clinicId, ALL_CLINIC_PERMISSIONS);
});

describe('Queue console: call-next / repeat / skip', () => {
  it('calls the next waiting patient and supports repeat-call', async () => {
    await checkInNewPatient(doctor.clinicId, doctor.doctorId, reception.token);

    const callRes = await request(app)
      .post('/api/v1/reception/queue/call-next')
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ clinicId: doctor.clinicId, doctorId: doctor.doctorId });
    expect(callRes.status).toBe(200);
    expect(callRes.body.data.queue.currentToken.status).toBe('CALLED');
    const tokenId = callRes.body.data.queue.currentToken.id;

    const repeatRes = await request(app)
      .post('/api/v1/reception/queue/repeat-call')
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ clinicId: doctor.clinicId, doctorId: doctor.doctorId, tokenId });
    expect(repeatRes.status).toBe(200);
    expect(repeatRes.body.data.queue.currentToken.calledCount).toBeGreaterThanOrEqual(2);
  });

  it('skips a waiting patient with a reason', async () => {
    await checkInNewPatient(doctor.clinicId, doctor.doctorId, reception.token);
    const snapshot = await request(app)
      .get(`/api/v1/reception/queue?clinicId=${doctor.clinicId}&doctorId=${doctor.doctorId}`)
      .set('Authorization', `Bearer ${reception.token}`);
    const waitingToken = snapshot.body.data.queue.waitingTokens[0];
    expect(waitingToken).toBeDefined();

    const res = await request(app)
      .post('/api/v1/reception/queue/skip')
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ clinicId: doctor.clinicId, doctorId: doctor.doctorId, tokenId: waitingToken.id, reason: 'Not present' });
    expect(res.status).toBe(200);
    expect(res.body.data.queue.skippedTodayCount).toBeGreaterThanOrEqual(1);
  });

  it('rejects queue.manage actions without permission', async () => {
    const noPerm = await createReceptionFixture(app, doctor.clinicId, [CLINIC_PERMISSIONS.QUEUE_VIEW]);
    const res = await request(app)
      .post('/api/v1/reception/queue/call-next')
      .set('Authorization', `Bearer ${noPerm.token}`)
      .send({ clinicId: doctor.clinicId, doctorId: doctor.doctorId });
    expect(res.status).toBe(403);
  });
});

describe('Consultation lifecycle from reception', () => {
  it('marks in-consultation then completed, mirroring the Doctor Portal cascade', async () => {
    const { appointment } = await checkInNewPatient(doctor.clinicId, doctor.doctorId, reception.token);

    const startRes = await request(app)
      .post('/api/v1/reception/queue/mark-in-consultation')
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ clinicId: doctor.clinicId, doctorId: doctor.doctorId, appointmentId: appointment.id });
    expect(startRes.status).toBe(200);

    const inProgress = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(inProgress.status).toBe('IN_CONSULTATION');

    const completeRes = await request(app)
      .post('/api/v1/reception/queue/mark-completed')
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ clinicId: doctor.clinicId, doctorId: doctor.doctorId, appointmentId: appointment.id });
    expect(completeRes.status).toBe(200);

    const completed = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(completed.status).toBe('COMPLETED');
  });

  it('marks an appointment no-show', async () => {
    const patient = await createPatientFixture(app);
    const appointment = await createAppointmentFixture({ patientId: patient.patientId, doctorId: doctor.doctorId, clinicId: doctor.clinicId, status: 'CONFIRMED' });

    const res = await request(app)
      .post('/api/v1/reception/queue/no-show')
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ clinicId: doctor.clinicId, doctorId: doctor.doctorId, appointmentId: appointment.id });
    expect(res.status).toBe(200);

    const updated = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(updated.status).toBe('NO_SHOW');
  });
});

describe('Manual delay control', () => {
  it('requires a reason whenever a delay is set', async () => {
    const res = await request(app)
      .patch('/api/v1/reception/queue/delay')
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ clinicId: doctor.clinicId, doctorId: doctor.doctorId, delayMinutes: 15, delayReason: '' });
    expect(res.status).toBe(400);
  });

  it('updates the delay with a reason and writes an audit log entry', async () => {
    const res = await request(app)
      .patch('/api/v1/reception/queue/delay')
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ clinicId: doctor.clinicId, doctorId: doctor.doctorId, delayMinutes: 15, delayReason: 'Doctor running late' });
    expect(res.status).toBe(200);
    expect(res.body.data.queue.session.delayMinutes).toBe(15);

    const auditRow = await prisma.auditLog.findFirst({
      where: { action: 'queue.delay_updated', clinicId: doctor.clinicId },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditRow).toBeTruthy();
    expect((auditRow!.metadata as Record<string, unknown>).delayMinutes).toBe(15);
  });

  it('rejects delay updates without the queue.delay.update permission', async () => {
    const noPerm = await createReceptionFixture(app, doctor.clinicId, [CLINIC_PERMISSIONS.QUEUE_VIEW]);
    const res = await request(app)
      .patch('/api/v1/reception/queue/delay')
      .set('Authorization', `Bearer ${noPerm.token}`)
      .send({ clinicId: doctor.clinicId, doctorId: doctor.doctorId, delayMinutes: 10, delayReason: 'Test' });
    expect(res.status).toBe(403);
  });
});

describe('Queue pause / resume', () => {
  it('pauses and resumes the queue, blocking call-next while paused', async () => {
    const pauseRes = await request(app)
      .post('/api/v1/reception/queue/session/pause')
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ clinicId: doctor.clinicId, doctorId: doctor.doctorId, reason: 'Staff break' });
    expect(pauseRes.status).toBe(200);
    expect(pauseRes.body.data.queue.session.queueStatus).toBe('PAUSED');
    expect(pauseRes.body.data.queue.pauseReason).toBe('Staff break');

    const callRes = await request(app)
      .post('/api/v1/reception/queue/call-next')
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ clinicId: doctor.clinicId, doctorId: doctor.doctorId });
    expect(callRes.status).toBe(409);

    const resumeRes = await request(app)
      .post('/api/v1/reception/queue/session/resume')
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ clinicId: doctor.clinicId, doctorId: doctor.doctorId });
    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body.data.queue.session.queueStatus).toBe('ACTIVE');
  });
});

describe('Priority control', () => {
  it('rejects priority updates without permission and allows them with permission', async () => {
    const { token } = await checkInNewPatient(doctor.clinicId, doctor.doctorId, reception.token);

    const noPerm = await createReceptionFixture(app, doctor.clinicId, [CLINIC_PERMISSIONS.QUEUE_VIEW]);
    const forbidden = await request(app)
      .patch('/api/v1/reception/queue/priority')
      .set('Authorization', `Bearer ${noPerm.token}`)
      .send({ clinicId: doctor.clinicId, doctorId: doctor.doctorId, tokenId: token.id, priority: 'EMERGENCY' });
    expect(forbidden.status).toBe(403);

    const allowed = await request(app)
      .patch('/api/v1/reception/queue/priority')
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ clinicId: doctor.clinicId, doctorId: doctor.doctorId, tokenId: token.id, priority: 'EMERGENCY' });
    expect(allowed.status).toBe(200);
    const updatedToken = allowed.body.data.queue.waitingTokens.find((t: { id: string }) => t.id === token.id);
    expect(updatedToken.priority).toBe('EMERGENCY');
    expect(updatedToken).toBe(allowed.body.data.queue.waitingTokens[0]);
  });
});

describe('Queue history', () => {
  it('records queue actions with actor and clinic scoping', async () => {
    const res = await request(app)
      .get(`/api/v1/reception/queue/history?clinicId=${doctor.clinicId}`)
      .set('Authorization', `Bearer ${reception.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.history.items.length).toBeGreaterThan(0);
    expect(res.body.data.history.items.every((e: { clinicId: string }) => e.clinicId === doctor.clinicId)).toBe(true);
  });
});

describe('Concurrency safety', () => {
  it('two simultaneous Call Next requests never call the same patient twice', async () => {
    const raceDoctor = await createDoctorFixture(app);
    const raceReception = await createReceptionFixture(app, raceDoctor.clinicId, ALL_CLINIC_PERMISSIONS);
    await checkInNewPatient(raceDoctor.clinicId, raceDoctor.doctorId, raceReception.token);

    const [resA, resB] = await Promise.all([
      request(app).post('/api/v1/reception/queue/call-next').set('Authorization', `Bearer ${raceReception.token}`).send({ clinicId: raceDoctor.clinicId, doctorId: raceDoctor.doctorId }),
      request(app).post('/api/v1/reception/queue/call-next').set('Authorization', `Bearer ${raceReception.token}`).send({ clinicId: raceDoctor.clinicId, doctorId: raceDoctor.doctorId }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 404]);

    const calledTokens = await prisma.queueToken.findMany({ where: { doctorSession: { doctorId: raceDoctor.doctorId, clinicId: raceDoctor.clinicId }, status: 'CALLED' } });
    expect(calledTokens.length).toBe(1);
  });

  it('two simultaneous check-ins never generate duplicate token numbers', async () => {
    const raceDoctor = await createDoctorFixture(app);
    const raceReception = await createReceptionFixture(app, raceDoctor.clinicId, ALL_CLINIC_PERMISSIONS);

    const patientA = await createPatientFixture(app);
    const patientB = await createPatientFixture(app);
    const appointmentA = await createAppointmentFixture({ patientId: patientA.patientId, doctorId: raceDoctor.doctorId, clinicId: raceDoctor.clinicId, status: 'CONFIRMED' });
    const appointmentB = await createAppointmentFixture({ patientId: patientB.patientId, doctorId: raceDoctor.doctorId, clinicId: raceDoctor.clinicId, status: 'CONFIRMED' });

    const [resA, resB] = await Promise.all([
      request(app).post('/api/v1/reception/checkin').set('Authorization', `Bearer ${raceReception.token}`).send({ appointmentId: appointmentA.id }),
      request(app).post('/api/v1/reception/checkin').set('Authorization', `Bearer ${raceReception.token}`).send({ appointmentId: appointmentB.id }),
    ]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(resA.body.data.token.tokenNumber).not.toBe(resB.body.data.token.tokenNumber);

    const tokens = await prisma.queueToken.findMany({ where: { doctorSession: { doctorId: raceDoctor.doctorId, clinicId: raceDoctor.clinicId } } });
    const tokenNumbers = tokens.map((t) => t.tokenNumber);
    expect(new Set(tokenNumbers).size).toBe(tokenNumbers.length);
  });
});
