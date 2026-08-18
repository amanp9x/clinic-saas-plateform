import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { UserRole } from '@clinic/shared';

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

describe('Waitlist notification integration', () => {
  it('cancelling an appointment notifies waitlisted patients for that doctor+clinic+date', async () => {
    const { fixture, date, dateObj } = await setupBookableDoctor();
    const patientA = await createPatientFixture(app);
    const patientB = await createPatientFixture(app);
    const slot = atTime(dateObj, '09:00');
    const appt = await createAppointmentFixture({ patientId: patientA.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot, status: 'CONFIRMED' });

    const joinRes = await request(app)
      .post('/api/v1/waitlist')
      .set('Authorization', `Bearer ${patientB.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, targetDate: date });
    const entryId = joinRes.body.data.entry.id as string;

    await request(app).post(`/api/v1/appointments/${appt.id}/cancel`).set('Authorization', `Bearer ${patientA.token}`).send({ reason: 'Cannot make it' });

    const notif = await prisma.notification.findFirst({ where: { userId: patientB.userId, type: 'WAITLIST_SLOT_AVAILABLE' } });
    expect(notif).not.toBeNull();

    const entry = await prisma.waitlistEntry.findUniqueOrThrow({ where: { id: entryId } });
    expect(entry.status).toBe('NOTIFIED');
    expect(entry.notifiedAt).not.toBeNull();
  });

  it('marking an appointment no-show also notifies waitlisted patients', async () => {
    const { fixture, date, dateObj } = await setupBookableDoctor();
    const patientA = await createPatientFixture(app);
    const patientB = await createPatientFixture(app);
    const slot = atTime(dateObj, '09:00');
    const appt = await createAppointmentFixture({ patientId: patientA.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot, status: 'CHECKED_IN' });

    await request(app).post('/api/v1/waitlist').set('Authorization', `Bearer ${patientB.token}`).send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, targetDate: date });

    await request(app).post(`/api/v1/doctor/appointments/${appt.id}/no-show`).set('Authorization', `Bearer ${fixture.token}`);

    const notif = await prisma.notification.findFirst({ where: { userId: patientB.userId, type: 'WAITLIST_SLOT_AVAILABLE' } });
    expect(notif).not.toBeNull();
  });

  it('rescheduling away from a date notifies that date\'s waitlist, and rescheduling into a waitlisted date fulfills it', async () => {
    const { fixture, date, dateObj } = await setupBookableDoctor();
    const patientMoving = await createPatientFixture(app);
    const waitingForOldDate = await createPatientFixture(app);
    const waitingForNewDate = await createPatientFixture(app);

    const oldSlot = atTime(dateObj, '09:00');
    const newSlot = atTime(dateObj, '09:30');
    const appt = await createAppointmentFixture({ patientId: patientMoving.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: oldSlot, status: 'CONFIRMED' });

    await request(app).post('/api/v1/waitlist').set('Authorization', `Bearer ${waitingForOldDate.token}`).send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, targetDate: date });
    await request(app).post('/api/v1/waitlist').set('Authorization', `Bearer ${waitingForNewDate.token}`).send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, targetDate: date });

    // Same patient being moved also has a standing entry for the exact new slot's date — this is
    // the "reschedule satisfies my own waitlist request" fulfillment path.
    const selfJoin = await request(app)
      .post('/api/v1/waitlist')
      .set('Authorization', `Bearer ${patientMoving.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, targetDate: date });

    await request(app)
      .patch(`/api/v1/appointments/${appt.id}/reschedule`)
      .set('Authorization', `Bearer ${patientMoving.token}`)
      .send({ newScheduledAt: newSlot.toISOString() });

    const oldDateNotif = await prisma.notification.findFirst({ where: { userId: waitingForOldDate.userId, type: 'WAITLIST_SLOT_AVAILABLE' } });
    expect(oldDateNotif).not.toBeNull();

    // Both `waitingForOldDate` and `waitingForNewDate` are waiting for the SAME calendar date —
    // rescheduling away vacates a slot on that date, so both are legitimately notified.
    const newDateNotif = await prisma.notification.findFirst({ where: { userId: waitingForNewDate.userId, type: 'WAITLIST_SLOT_AVAILABLE' } });
    expect(newDateNotif).not.toBeNull();

    const selfEntry = await prisma.waitlistEntry.findUniqueOrThrow({ where: { id: selfJoin.body.data.entry.id } });
    expect(selfEntry.status).toBe('FULFILLED');
    expect(selfEntry.fulfilledAppointmentId).toBe(appt.id);
  });

  it('booking a slot that matches a standing waitlist request fulfills it', async () => {
    const { fixture, date, dateObj } = await setupBookableDoctor();
    const patient = await createPatientFixture(app);
    const slot = atTime(dateObj, '09:00');

    const joinRes = await request(app)
      .post('/api/v1/waitlist')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, targetDate: date });

    const holdRes = await request(app)
      .post('/api/v1/appointments/hold')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC' });
    const bookRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ holdId: holdRes.body.data.hold.id, appointmentType: 'NEW_CONSULTATION' });
    expect(bookRes.status).toBe(201);

    const entry = await prisma.waitlistEntry.findUniqueOrThrow({ where: { id: joinRes.body.data.entry.id } });
    expect(entry.status).toBe('FULFILLED');
    expect(entry.fulfilledAppointmentId).toBe(bookRes.body.data.appointment.id);
  });

  it('a waitlist entry for a different doctor is never notified by an unrelated cancellation', async () => {
    const { fixture: fixtureA, date, dateObj } = await setupBookableDoctor();
    const fixtureB = await createDoctorFixture(app);
    const patientA = await createPatientFixture(app);
    const unrelatedWaiter = await createPatientFixture(app);
    const slot = atTime(dateObj, '09:00');
    const appt = await createAppointmentFixture({ patientId: patientA.patientId, doctorId: fixtureA.doctorId, clinicId: fixtureA.clinicId, scheduledAt: slot, status: 'CONFIRMED' });

    await request(app)
      .post('/api/v1/waitlist')
      .set('Authorization', `Bearer ${unrelatedWaiter.token}`)
      .send({ doctorId: fixtureB.doctorId, clinicId: fixtureB.clinicId, targetDate: date });

    await request(app).post(`/api/v1/appointments/${appt.id}/cancel`).set('Authorization', `Bearer ${patientA.token}`).send({ reason: 'Cannot make it' });

    const notif = await prisma.notification.findFirst({ where: { userId: unrelatedWaiter.userId, type: 'WAITLIST_SLOT_AVAILABLE' } });
    expect(notif).toBeNull();
  });
});

describe('Analytics integration (Phase 11 extension)', () => {
  it('the clinic analytics overview reflects the live active-waitlist count', async () => {
    const fixture = await createDoctorFixture(app);
    const admin = await createReceptionFixture(app, fixture.clinicId, [], { role: UserRole.CLINIC_ADMIN });
    const patient = await createPatientFixture(app);
    const { date } = tomorrowInfo();

    const before = await request(app).get('/api/v1/analytics/overview').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${admin.token}`);
    expect(before.body.data.waitlist.activeCount).toBe(0);

    await request(app).post('/api/v1/waitlist').set('Authorization', `Bearer ${patient.token}`).send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, targetDate: date });

    const after = await request(app).get('/api/v1/analytics/overview').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${admin.token}`);
    expect(after.body.data.waitlist.activeCount).toBe(1);
  });
});
