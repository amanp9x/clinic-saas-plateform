import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { CLINIC_PERMISSIONS } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const {
  createDoctorFixture,
  createPatientFixture,
  createDoctorAvailabilityFixture,
  createClinicWorkingHoursFixture,
  tomorrowInfo,
  atTime,
} = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');

const app = createApp();

async function setupBookableDoctor() {
  const fixture = await createDoctorFixture(app);
  const { date, weekday, dateObj } = tomorrowInfo();
  await createClinicWorkingHoursFixture(fixture.clinicId, { weekday, sessions: [{ startTime: '09:00', endTime: '13:00' }] });
  await createDoctorAvailabilityFixture(fixture.clinicDoctorId, { weekday, startTime: '09:00', endTime: '13:00', consultationDurationMinutes: 15 });
  return { fixture, date, dateObj };
}

describe('POST /api/v1/clinic/blocked-slots', () => {
  it('a doctor blocks their own slot, which then shows BLOCKED and cannot be booked', async () => {
    const { fixture, date, dateObj } = await setupBookableDoctor();
    const slotStart = atTime(dateObj, '09:00');
    const slotEnd = atTime(dateObj, '09:15');

    const blockRes = await request(app)
      .post('/api/v1/clinic/blocked-slots')
      .set('Authorization', `Bearer ${fixture.token}`)
      .send({ clinicId: fixture.clinicId, startAt: slotStart.toISOString(), endAt: slotEnd.toISOString(), reason: 'Personal' });
    expect(blockRes.status).toBe(201);

    const availRes = await request(app).get(`/api/v1/appointments/availability?doctorId=${fixture.doctorId}&clinicId=${fixture.clinicId}&date=${date}`);
    const blockedSlot = availRes.body.data.slots.find((s: { startAt: string }) => new Date(s.startAt).getTime() === slotStart.getTime());
    expect(blockedSlot.status).toBe('BLOCKED');

    const patient = await createPatientFixture(app);
    const bookRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slotStart.toISOString(), consultationType: 'IN_CLINIC', appointmentType: 'NEW_CONSULTATION' });
    expect(bookRes.status).toBe(409);
  });

  it('a doctor cannot block a slot for a different doctor', async () => {
    const { fixture, dateObj } = await setupBookableDoctor();
    const otherFixture = await createDoctorFixture(app);
    const slotStart = atTime(dateObj, '09:00');
    const slotEnd = atTime(dateObj, '09:15');

    const res = await request(app)
      .post('/api/v1/clinic/blocked-slots')
      .set('Authorization', `Bearer ${fixture.token}`)
      .send({ clinicId: fixture.clinicId, doctorId: otherFixture.doctorId, startAt: slotStart.toISOString(), endAt: slotEnd.toISOString(), reason: 'Personal' });
    expect(res.status).toBe(404);
  });

  it('clinic staff with APPOINTMENT_MANAGE can block any doctor at their clinic', async () => {
    const { fixture, dateObj } = await setupBookableDoctor();
    const reception = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.APPOINTMENT_MANAGE]);
    const slotStart = atTime(dateObj, '09:00');
    const slotEnd = atTime(dateObj, '09:15');

    const res = await request(app)
      .post('/api/v1/clinic/blocked-slots')
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ clinicId: fixture.clinicId, doctorId: fixture.doctorId, startAt: slotStart.toISOString(), endAt: slotEnd.toISOString(), reason: 'Clinic event' });
    expect(res.status).toBe(201);
  });

  it('clinic staff without APPOINTMENT_MANAGE cannot block', async () => {
    const { fixture, dateObj } = await setupBookableDoctor();
    const reception = await createReceptionFixture(app, fixture.clinicId, []);
    const slotStart = atTime(dateObj, '09:00');
    const slotEnd = atTime(dateObj, '09:15');

    const res = await request(app)
      .post('/api/v1/clinic/blocked-slots')
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ clinicId: fixture.clinicId, startAt: slotStart.toISOString(), endAt: slotEnd.toISOString(), reason: 'Clinic event' });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/v1/clinic/blocked-slots/:id', () => {
  it('unblocking reopens the slot', async () => {
    const { fixture, date, dateObj } = await setupBookableDoctor();
    const slotStart = atTime(dateObj, '09:00');
    const slotEnd = atTime(dateObj, '09:15');

    const blockRes = await request(app)
      .post('/api/v1/clinic/blocked-slots')
      .set('Authorization', `Bearer ${fixture.token}`)
      .send({ clinicId: fixture.clinicId, startAt: slotStart.toISOString(), endAt: slotEnd.toISOString(), reason: 'Personal' });

    const unblockRes = await request(app)
      .delete(`/api/v1/clinic/blocked-slots/${blockRes.body.data.block.id}?clinicId=${fixture.clinicId}`)
      .set('Authorization', `Bearer ${fixture.token}`);
    expect(unblockRes.status).toBe(200);

    const availRes = await request(app).get(`/api/v1/appointments/availability?doctorId=${fixture.doctorId}&clinicId=${fixture.clinicId}&date=${date}`);
    const slot = availRes.body.data.slots.find((s: { startAt: string }) => new Date(s.startAt).getTime() === slotStart.getTime());
    expect(slot.status).toBe('AVAILABLE');
  });
});
