import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { UserRole } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');

const app = createApp();

let clinic: Awaited<ReturnType<typeof createDoctorFixture>>;
let admin: Awaited<ReturnType<typeof createReceptionFixture>>;

beforeAll(async () => {
  clinic = await createDoctorFixture(app);
  admin = await createReceptionFixture(app, clinic.clinicId, [], { role: UserRole.CLINIC_ADMIN });
});

describe('Working hours', () => {
  it('lists all seven weekdays with sensible defaults', async () => {
    const res = await request(app).get(`/api/v1/clinic/schedule?clinicId=${clinic.clinicId}`).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.workingHours.length).toBe(7);
  });

  it('sets Monday hours with two non-overlapping sessions', async () => {
    const res = await request(app)
      .put('/api/v1/clinic/schedule')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        clinicId: clinic.clinicId,
        weekday: 'MON',
        isOpen: true,
        sessions: [
          { startTime: '09:00', endTime: '13:00' },
          { startTime: '17:00', endTime: '21:00' },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.data.workingHours.sessions.length).toBe(2);
  });

  it('rejects overlapping sessions', async () => {
    const res = await request(app)
      .put('/api/v1/clinic/schedule')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        clinicId: clinic.clinicId,
        weekday: 'TUE',
        isOpen: true,
        sessions: [
          { startTime: '09:00', endTime: '14:00' },
          { startTime: '13:00', endTime: '18:00' },
        ],
      });
    expect(res.status).toBe(400);
  });

  it('rejects a session where opening time is not before closing time', async () => {
    const res = await request(app)
      .put('/api/v1/clinic/schedule')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, weekday: 'WED', isOpen: true, sessions: [{ startTime: '14:00', endTime: '09:00' }] });
    expect(res.status).toBe(400);
  });

  it('marks a weekday closed', async () => {
    const res = await request(app)
      .put('/api/v1/clinic/schedule')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, weekday: 'SUN', isOpen: false, sessions: [] });
    expect(res.status).toBe(200);
    expect(res.body.data.workingHours.isOpen).toBe(false);
  });
});

describe('Holidays', () => {
  it('creates a holiday', async () => {
    const res = await request(app)
      .post('/api/v1/clinic/holidays')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, date: '2026-10-02', name: 'Gandhi Jayanti', isFullDay: true });
    expect(res.status).toBe(201);
  });

  it('rejects a duplicate holiday on the same date', async () => {
    const res = await request(app)
      .post('/api/v1/clinic/holidays')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, date: '2026-10-02', name: 'Duplicate Holiday' });
    expect(res.status).toBe(409);
  });

  it('rejects a partial-day holiday without valid times', async () => {
    const res = await request(app)
      .post('/api/v1/clinic/holidays')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, date: '2026-11-14', name: 'Half day', isFullDay: false });
    expect(res.status).toBe(400);
  });

  it('lists and removes a holiday', async () => {
    const listRes = await request(app).get(`/api/v1/clinic/holidays?clinicId=${clinic.clinicId}`).set('Authorization', `Bearer ${admin.token}`);
    expect(listRes.status).toBe(200);
    const holiday = listRes.body.data.holidays.find((h: { name: string }) => h.name === 'Gandhi Jayanti');
    expect(holiday).toBeDefined();

    const removeRes = await request(app).delete(`/api/v1/clinic/holidays/${holiday.id}?clinicId=${clinic.clinicId}`).set('Authorization', `Bearer ${admin.token}`);
    expect(removeRes.status).toBe(200);
  });
});

describe('Resources', () => {
  it('creates, updates status, and lists resources', async () => {
    const createRes = await request(app)
      .post('/api/v1/clinic/resources')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, name: 'Consult Room A', type: 'CONSULTATION_ROOM', code: 'A1', capacity: 2 });
    expect(createRes.status).toBe(201);
    const resourceId = createRes.body.data.resource.id;

    const updateRes = await request(app)
      .patch(`/api/v1/clinic/resources/${resourceId}?clinicId=${clinic.clinicId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'MAINTENANCE' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.resource.status).toBe('MAINTENANCE');

    const listRes = await request(app).get(`/api/v1/clinic/resources?clinicId=${clinic.clinicId}`).set('Authorization', `Bearer ${admin.token}`);
    expect(listRes.body.data.resources.some((r: { id: string }) => r.id === resourceId)).toBe(true);
  });
});
