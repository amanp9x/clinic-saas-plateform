import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { CLINIC_PERMISSIONS } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const {
  createDoctorFixture,
  createPatientFixture,
  createAppointmentFixture,
  createDoctorAvailabilityFixture,
  createClinicWorkingHoursFixture,
  tomorrowInfo,
  atTime,
} = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

async function setupBookableDoctor() {
  const fixture = await createDoctorFixture(app);
  const { date, weekday, dateObj } = tomorrowInfo();
  await createClinicWorkingHoursFixture(fixture.clinicId, { weekday, sessions: [{ startTime: '09:00', endTime: '13:00' }] });
  await createDoctorAvailabilityFixture(fixture.clinicDoctorId, { weekday, startTime: '09:00', endTime: '13:00', consultationDurationMinutes: 15 });
  return { fixture, date, dateObj };
}

describe('MANDATORY: two concurrent joins for the same patient+doctor+clinic+date', () => {
  it('produce exactly one ACTIVE waitlist entry', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const { date } = tomorrowInfo();

    const join = () =>
      request(app).post('/api/v1/waitlist').set('Authorization', `Bearer ${patient.token}`).send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, targetDate: date });
    const [r1, r2] = await Promise.all([join(), join()]);

    expect([r1.status, r2.status].sort()).toEqual([201, 409]);

    const count = await prisma.waitlistEntry.count({
      where: { patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: { in: ['ACTIVE', 'NOTIFIED'] } },
    });
    expect(count).toBe(1);
  });
});

describe('MANDATORY: two concurrent cancels of the same waitlist entry', () => {
  it('exactly one succeeds, the other is a 409, and the entry ends CANCELLED exactly once', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.APPOINTMENT_MANAGE]);
    const { date } = tomorrowInfo();
    const created = await request(app)
      .post('/api/v1/waitlist')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, targetDate: date });
    const entryId = created.body.data.entry.id as string;

    const [patientCancel, staffCancel] = await Promise.all([
      request(app).delete(`/api/v1/waitlist/${entryId}`).set('Authorization', `Bearer ${patient.token}`),
      request(app).delete(`/api/v1/clinic/waitlist/${entryId}?clinicId=${fixture.clinicId}`).set('Authorization', `Bearer ${staff.token}`),
    ]);

    expect([patientCancel.status, staffCancel.status].sort()).toEqual([200, 409]);

    const entry = await prisma.waitlistEntry.findUniqueOrThrow({ where: { id: entryId } });
    expect(entry.status).toBe('CANCELLED');
  });
});

describe('MANDATORY: simultaneous freed-slot events for the same waitlist entry never double-notify', () => {
  it('two appointments for the same doctor+clinic+date, cancelled concurrently, produce exactly one WAITLIST_SLOT_AVAILABLE notification', async () => {
    const { fixture, date, dateObj } = await setupBookableDoctor();
    const patientA = await createPatientFixture(app);
    const patientC = await createPatientFixture(app);
    const waiter = await createPatientFixture(app);

    const slotA = atTime(dateObj, '09:00');
    const slotC = atTime(dateObj, '09:30');
    const apptA = await createAppointmentFixture({ patientId: patientA.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slotA, status: 'CONFIRMED' });
    const apptC = await createAppointmentFixture({ patientId: patientC.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slotC, status: 'CONFIRMED' });

    const joinRes = await request(app)
      .post('/api/v1/waitlist')
      .set('Authorization', `Bearer ${waiter.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, targetDate: date });
    const entryId = joinRes.body.data.entry.id as string;

    const cancel = (id: string, token: string) => request(app).post(`/api/v1/appointments/${id}/cancel`).set('Authorization', `Bearer ${token}`).send({ reason: 'Concurrency test' });
    await Promise.all([cancel(apptA.id, patientA.token), cancel(apptC.id, patientC.token)]);

    const count = await prisma.notification.count({ where: { userId: waiter.userId, type: 'WAITLIST_SLOT_AVAILABLE' } });
    expect(count).toBe(1);

    const entry = await prisma.waitlistEntry.findUniqueOrThrow({ where: { id: entryId } });
    expect(entry.status).toBe('NOTIFIED');
  });
});
