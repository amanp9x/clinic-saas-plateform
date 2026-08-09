import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture } = await import('../helpers/doctor-fixtures.js');

const app = createApp();

let doctor: Awaited<ReturnType<typeof createDoctorFixture>>;
let otherDoctor: Awaited<ReturnType<typeof createDoctorFixture>>;

beforeAll(async () => {
  doctor = await createDoctorFixture(app);
  otherDoctor = await createDoctorFixture(app);
});

describe('Doctor schedule (availability)', () => {
  it('creates a schedule slot for an owned clinic', async () => {
    const res = await request(app)
      .post('/api/v1/doctor/schedule')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({
        clinicId: doctor.clinicId,
        weekday: 'MON',
        startTime: '09:00',
        endTime: '13:00',
        consultationDurationMinutes: 15,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.slot.weekday).toBe('MON');
    expect(res.body.data.slot.startTime).toBe('09:00');
  });

  it('rejects creating a slot for a clinic the doctor is not associated with', async () => {
    const res = await request(app)
      .post('/api/v1/doctor/schedule')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({
        clinicId: otherDoctor.clinicId,
        weekday: 'TUE',
        startTime: '09:00',
        endTime: '13:00',
        consultationDurationMinutes: 15,
      });
    expect(res.status).toBe(403);
  });

  it('rejects a slot where start time is after end time', async () => {
    const res = await request(app)
      .post('/api/v1/doctor/schedule')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({
        clinicId: doctor.clinicId,
        weekday: 'WED',
        startTime: '14:00',
        endTime: '10:00',
        consultationDurationMinutes: 15,
      });
    expect(res.status).toBe(400);
  });

  it('lists, updates, and deletes a schedule slot', async () => {
    const createRes = await request(app)
      .post('/api/v1/doctor/schedule')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({
        clinicId: doctor.clinicId,
        weekday: 'THU',
        startTime: '16:00',
        endTime: '20:00',
        consultationDurationMinutes: 20,
      });
    const slotId = createRes.body.data.slot.id;

    const listRes = await request(app)
      .get('/api/v1/doctor/schedule')
      .set('Authorization', `Bearer ${doctor.token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.slots.some((s: { id: string }) => s.id === slotId)).toBe(true);

    const updateRes = await request(app)
      .patch(`/api/v1/doctor/schedule/${slotId}`)
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({
        clinicId: doctor.clinicId,
        weekday: 'THU',
        startTime: '17:00',
        endTime: '20:00',
        consultationDurationMinutes: 20,
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.slot.startTime).toBe('17:00');

    const deleteRes = await request(app)
      .delete(`/api/v1/doctor/schedule/${slotId}`)
      .set('Authorization', `Bearer ${doctor.token}`);
    expect(deleteRes.status).toBe(200);
  });

  it("rejects updating another doctor's schedule slot", async () => {
    const createRes = await request(app)
      .post('/api/v1/doctor/schedule')
      .set('Authorization', `Bearer ${otherDoctor.token}`)
      .send({
        clinicId: otherDoctor.clinicId,
        weekday: 'FRI',
        startTime: '09:00',
        endTime: '13:00',
        consultationDurationMinutes: 15,
      });
    const slotId = createRes.body.data.slot.id;

    const res = await request(app)
      .delete(`/api/v1/doctor/schedule/${slotId}`)
      .set('Authorization', `Bearer ${doctor.token}`);
    expect(res.status).toBe(404);
  });
});

describe('Doctor leaves', () => {
  it('creates, lists, and deletes a leave', async () => {
    const createRes = await request(app)
      .post('/api/v1/doctor/leaves')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({
        clinicId: doctor.clinicId,
        startDate: '2027-01-10',
        endDate: '2027-01-12',
        reason: 'Conference',
        type: 'LEAVE',
      });
    expect(createRes.status).toBe(201);
    const leaveId = createRes.body.data.leave.id;

    const listRes = await request(app)
      .get('/api/v1/doctor/leaves')
      .set('Authorization', `Bearer ${doctor.token}`);
    expect(listRes.body.data.leaves.some((l: { id: string }) => l.id === leaveId)).toBe(true);

    const deleteRes = await request(app)
      .delete(`/api/v1/doctor/leaves/${leaveId}`)
      .set('Authorization', `Bearer ${doctor.token}`);
    expect(deleteRes.status).toBe(200);
  });

  it('rejects a leave for an unassociated clinic', async () => {
    const res = await request(app)
      .post('/api/v1/doctor/leaves')
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ clinicId: otherDoctor.clinicId, startDate: '2027-02-01', endDate: '2027-02-02' });
    expect(res.status).toBe(403);
  });
});

describe('Clinic association settings', () => {
  it('updates fee/duration overrides and delay authorization', async () => {
    const res = await request(app)
      .patch(`/api/v1/doctor/clinics/${doctor.clinicId}`)
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ consultationFeeOverride: 750, consultationDurationMinutesOverride: 20 });
    expect(res.status).toBe(200);
    expect(res.body.data.clinic.consultationFeeOverride).toBe('750');
    expect(res.body.data.clinic.canOverrideDelay).toBe(false);
  });
});
