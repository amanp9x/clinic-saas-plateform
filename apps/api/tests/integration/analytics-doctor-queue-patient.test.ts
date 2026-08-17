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
} = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

/** Local-calendar-date string (YYYY-MM-DD) — NOT `.toISOString().slice(0, 10)`, which converts to
 * UTC first and would silently roll back to the previous calendar day on a positive-UTC-offset
 * test machine, misaligning the query range against fixtures built with local-time dates. */
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function adminFor(clinicId: string) {
  return createReceptionFixture(app, clinicId, [], { role: UserRole.CLINIC_ADMIN });
}

describe('Doctor utilization', () => {
  it('is null (not zero) when the doctor has no availability template for the range — never divides by zero', async () => {
    const fixture = await createDoctorFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const res = await request(app)
      .get('/api/v1/analytics/doctors')
      .query({ clinicId: fixture.clinicId, range: 'last7days' })
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.rows[0].utilization).toBeNull();
  });

  it('computes utilization = booked minutes / available capacity minutes when a template exists', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const { weekday, dateObj } = tomorrowInfo();
    // 4 hours of availability = 240 minutes capacity for exactly one matching weekday in a 1-day range.
    await createDoctorAvailabilityFixture(fixture.clinicDoctorId, { weekday, startTime: '09:00', endTime: '13:00', consultationDurationMinutes: 30 });
    const slot = new Date(dateObj);
    slot.setHours(9, 0, 0, 0);
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED', scheduledAt: slot });
    await prisma.appointment.update({ where: { id: appt.id }, data: { durationMinutes: 60 } });

    const from = localDateStr(dateObj);
    const res = await request(app)
      .get('/api/v1/analytics/doctors')
      .query({ clinicId: fixture.clinicId, range: 'custom', from, to: from })
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    // 60 booked minutes / 240 available minutes = 0.25
    expect(res.body.data.rows[0].utilization).toBeCloseTo(0.25, 4);
  });

  it('excludes leave days from available capacity', async () => {
    const fixture = await createDoctorFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const { weekday, dateObj } = tomorrowInfo();
    await createDoctorAvailabilityFixture(fixture.clinicDoctorId, { weekday, startTime: '09:00', endTime: '13:00' });
    const from = localDateStr(dateObj);
    // A bare "YYYY-MM-DD" string parses as UTC midnight per the ECMAScript date-only-string rule —
    // the same convention `doctor.service.ts::createLeave` relies on for `@db.Date` columns.
    await prisma.doctorLeave.create({ data: { doctorId: fixture.doctorId, clinicId: fixture.clinicId, startDate: new Date(from), endDate: new Date(from), type: 'LEAVE' } });
    const res = await request(app)
      .get(`/api/v1/analytics/doctors/${fixture.doctorId}/availability`)
      .query({ clinicId: fixture.clinicId, range: 'custom', from, to: from })
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.availableHours).toBe(0);
    expect(res.body.data.leaveDays).toBe(1);
    expect(res.body.data.utilization).toBeNull();
  });

  it('a doctor cannot view another doctor\'s availability', async () => {
    const fixtureA = await createDoctorFixture(app);
    const fixtureB = await createDoctorFixture(app);
    await prisma.clinicDoctor.create({ data: { clinicId: fixtureA.clinicId, doctorId: fixtureB.doctorId } });
    const res = await request(app)
      .get(`/api/v1/analytics/doctors/${fixtureB.doctorId}/availability`)
      .query({ clinicId: fixtureA.clinicId, range: 'last7days' })
      .set('Authorization', `Bearer ${fixtureA.token}`);
    expect(res.status).toBe(403);
  });
});

describe('Queue & waiting time analytics', () => {
  async function buildQueueScenario(clinicId: string, doctorId: string, patientId: string, waitMinutes: number) {
    const session = await prisma.doctorSession.create({ data: { doctorId, clinicId, sessionDate: new Date(new Date().toDateString()), status: 'AVAILABLE', queueStatus: 'ACTIVE' } });
    const now = new Date();
    const checkinAt = new Date(now.getTime() - waitMinutes * 60_000);
    const appt = await createAppointmentFixture({ patientId, doctorId, clinicId, status: 'COMPLETED', scheduledAt: checkinAt });
    const token = await prisma.queueToken.create({
      data: { doctorSessionId: session.id, appointmentId: appt.id, patientId, tokenNumber: 1, type: 'SCHEDULED', status: 'COMPLETED', calledAt: checkinAt, createdAt: checkinAt },
    });
    await prisma.consultation.create({
      data: { appointmentId: appt.id, doctorId, patientId, clinicId, tokenId: token.id, status: 'COMPLETED', startedAt: now, completedAt: new Date(now.getTime() + 10 * 60_000) },
    });
    return { session, token, appt };
  }

  it('waiting time = consultation start − check-in (QueueToken.createdAt), not scheduled-vs-actual delay', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const admin = await adminFor(fixture.clinicId);
    await buildQueueScenario(fixture.clinicId, fixture.doctorId, patient.patientId, 20);

    const res = await request(app).get('/api/v1/analytics/queue').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.breakdown.averageWaitingMinutes).toBeCloseTo(20, 0);
    expect(res.body.data.breakdown.medianWaitingMinutes).toBeCloseTo(20, 0);
    expect(res.body.data.breakdown.completed).toBe(1);
  });

  it('average consultation duration is derived from Consultation.startedAt/completedAt', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const admin = await adminFor(fixture.clinicId);
    await buildQueueScenario(fixture.clinicId, fixture.doctorId, patient.patientId, 5);

    const res = await request(app).get('/api/v1/analytics/overview').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${admin.token}`);
    expect(res.body.data.averageConsultationMinutes).toBeCloseTo(10, 0);
  });

  it('excludes samples with no consultation start (still waiting / never seen)', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const session = await prisma.doctorSession.create({ data: { doctorId: fixture.doctorId, clinicId: fixture.clinicId, sessionDate: new Date(new Date().toDateString()), status: 'AVAILABLE', queueStatus: 'ACTIVE' } });
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'CHECKED_IN' });
    await prisma.queueToken.create({ data: { doctorSessionId: session.id, appointmentId: appt.id, patientId: patient.patientId, tokenNumber: 1, type: 'SCHEDULED', status: 'WAITING' } });

    const res = await request(app).get('/api/v1/analytics/queue').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${admin.token}`);
    expect(res.body.data.breakdown.averageWaitingMinutes).toBeNull();
    expect(res.body.data.breakdown.checkedIn).toBe(1);
  });

  it('excludes a corrupt record where consultation start precedes check-in — never reports a negative waiting time', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const admin = await adminFor(fixture.clinicId);
    // waitMinutes: -30 => checkinAt is 30 minutes AFTER "now" (consultation start), an impossible
    // ordering that only hand-authored/backdated data could produce.
    await buildQueueScenario(fixture.clinicId, fixture.doctorId, patient.patientId, -30);

    const res = await request(app).get('/api/v1/analytics/queue').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.breakdown.averageWaitingMinutes).toBeNull();
    expect(res.body.data.breakdown.medianWaitingMinutes).toBeNull();
    expect(res.body.data.breakdown.maximumWaitingMinutes).toBeNull();
  });
});

describe('Delay analytics — from the existing audit trail, no duplicate tracking table', () => {
  it('aggregates average/max delay per doctor from queue.delay_updated audit rows', async () => {
    const fixture = await createDoctorFixture(app, { canOverrideDelay: true });
    const admin = await adminFor(fixture.clinicId);
    const { weekday } = tomorrowInfo();
    await createClinicWorkingHoursFixture(fixture.clinicId, { weekday, sessions: [{ startTime: '09:00', endTime: '13:00' }] });
    await createDoctorAvailabilityFixture(fixture.clinicDoctorId, { weekday, startTime: '09:00', endTime: '13:00' });
    await prisma.doctorSession.create({ data: { doctorId: fixture.doctorId, clinicId: fixture.clinicId, sessionDate: new Date(new Date().toDateString()), status: 'AVAILABLE', queueStatus: 'ACTIVE' } });

    await request(app).patch('/api/v1/doctor/queue/delay').set('Authorization', `Bearer ${fixture.token}`).send({ clinicId: fixture.clinicId, delayMinutes: 10 });
    await request(app).patch('/api/v1/doctor/queue/delay').set('Authorization', `Bearer ${fixture.token}`).send({ clinicId: fixture.clinicId, delayMinutes: 30 });

    const res = await request(app).get('/api/v1/analytics/delay').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.rows).toHaveLength(1);
    expect(res.body.data.rows[0].delayedSessionCount).toBe(1); // same session, distinct-counted once
    expect(res.body.data.rows[0].averageDelayMinutes).toBeCloseTo(20, 0); // avg of the two logged updates (10, 30)
    expect(res.body.data.rows[0].maximumDelayMinutes).toBe(30);
  });
});

describe('Patient analytics — new vs returning, repeat rate', () => {
  it('classifies a patient as new when their first-ever visit at this clinic falls inside the range, returning otherwise', async () => {
    const fixture = await createDoctorFixture(app);
    const newPatient = await createPatientFixture(app);
    const returningPatient = await createPatientFixture(app);
    const admin = await adminFor(fixture.clinicId);

    // Returning patient's first visit was well before the test range.
    await createAppointmentFixture({ patientId: returningPatient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED', scheduledAt: new Date('2020-01-01T09:00:00') });
    // Both patients have a visit inside today's range.
    await createAppointmentFixture({ patientId: newPatient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });
    await createAppointmentFixture({ patientId: returningPatient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });

    const res = await request(app).get('/api/v1/analytics/patients').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.breakdown.totalPatientsServed).toBe(2);
    expect(res.body.data.breakdown.newPatients).toBe(1);
    expect(res.body.data.breakdown.returningPatients).toBe(1);
  });

  it('repeat appointment rate reflects the share of in-range patients with more than one appointment', async () => {
    const fixture = await createDoctorFixture(app);
    const repeatPatient = await createPatientFixture(app);
    const onceOnlyPatient = await createPatientFixture(app);
    const admin = await adminFor(fixture.clinicId);
    await createAppointmentFixture({ patientId: repeatPatient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });
    await createAppointmentFixture({ patientId: repeatPatient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });
    await createAppointmentFixture({ patientId: onceOnlyPatient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });

    const res = await request(app).get('/api/v1/analytics/patients').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${admin.token}`);
    expect(res.body.data.breakdown.repeatAppointmentRate).toBeCloseTo(0.5, 4);
    expect(res.body.data.breakdown.averageAppointmentsPerPatient).toBeCloseTo(1.5, 4);
  });
});
