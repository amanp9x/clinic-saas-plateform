import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { UserRole } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');

const app = createApp();

async function adminFor(clinicId: string) {
  return createReceptionFixture(app, clinicId, [], { role: UserRole.CLINIC_ADMIN });
}

describe('Date range validation', () => {
  it('rejects a custom range missing from/to', async () => {
    const fixture = await createDoctorFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const res = await request(app)
      .get('/api/v1/analytics/overview')
      .query({ clinicId: fixture.clinicId, range: 'custom' })
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(400);
  });

  it('rejects a custom range where from > to', async () => {
    const fixture = await createDoctorFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const res = await request(app)
      .get('/api/v1/analytics/overview')
      .query({ clinicId: fixture.clinicId, range: 'custom', from: '2026-06-10', to: '2026-06-01' })
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(400);
  });

  it('rejects a custom range spanning more than 366 days', async () => {
    const fixture = await createDoctorFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const res = await request(app)
      .get('/api/v1/analytics/overview')
      .query({ clinicId: fixture.clinicId, range: 'custom', from: '2020-01-01', to: '2026-01-01' })
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(400);
  });

  it('rejects a malformed date string', async () => {
    const fixture = await createDoctorFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const res = await request(app)
      .get('/api/v1/analytics/overview')
      .query({ clinicId: fixture.clinicId, range: 'custom', from: 'not-a-date', to: '2026-06-01' })
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(400);
  });

  it('accepts a valid custom range and echoes [start, end) boundaries', async () => {
    const fixture = await createDoctorFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const res = await request(app)
      .get('/api/v1/analytics/overview')
      .query({ clinicId: fixture.clinicId, range: 'custom', from: '2026-06-01', to: '2026-06-07' })
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.range.preset).toBe('custom');
    const start = new Date(res.body.data.range.start);
    const end = new Date(res.body.data.range.end);
    // Compared against local-time construction (not UTC ISO slicing) — this codebase's date
    // boundaries are server-local, so a positive-UTC-offset test machine would otherwise see the
    // ISO string roll back to the previous UTC calendar day even though the local moment is right.
    expect(start.getTime()).toBe(new Date('2026-06-01T00:00:00').getTime());
    // end is exclusive — the day AFTER "to", per the [start, end) convention.
    expect(end.getTime()).toBe(new Date('2026-06-08T00:00:00').getTime());
  });

  it('[start, end) boundary: an appointment scheduled exactly at midnight on the "to" date is included; one on the day after is not', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const admin = await adminFor(fixture.clinicId);

    const includedBoundary = new Date('2026-07-10T00:00:00');
    const excludedNextDay = new Date('2026-07-11T00:00:00');
    await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED', scheduledAt: includedBoundary });
    await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED', scheduledAt: excludedNextDay });

    const res = await request(app)
      .get('/api/v1/analytics/appointments')
      .query({ clinicId: fixture.clinicId, range: 'custom', from: '2026-07-01', to: '2026-07-10' })
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.breakdown.total).toBe(1);
  });

  it('"today" and "yesterday" never double-count the same appointment', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const now = new Date();
    now.setHours(10, 0, 0, 0);
    await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'CONFIRMED', scheduledAt: now });

    const [todayRes, yesterdayRes] = await Promise.all([
      request(app).get('/api/v1/analytics/appointments').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${admin.token}`),
      request(app).get('/api/v1/analytics/appointments').query({ clinicId: fixture.clinicId, range: 'yesterday' }).set('Authorization', `Bearer ${admin.token}`),
    ]);
    expect(todayRes.body.data.breakdown.total).toBe(1);
    expect(yesterdayRes.body.data.breakdown.total).toBe(0);
  });

  it('rejects an unsupported range preset', async () => {
    const fixture = await createDoctorFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const res = await request(app)
      .get('/api/v1/analytics/overview')
      .query({ clinicId: fixture.clinicId, range: 'nextCentury' })
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(400);
  });

  it('documents the clinic timezone in the resolved range response context (clinic exists check succeeds and the clinic has a timezone field)', async () => {
    const fixture = await createDoctorFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const { prisma } = await import('../../src/config/database.js');
    const clinic = await prisma.clinic.findUniqueOrThrow({ where: { id: fixture.clinicId } });
    expect(clinic.timezone).toBeTruthy();
    const res = await request(app)
      .get('/api/v1/analytics/overview')
      .query({ clinicId: fixture.clinicId, range: 'today' })
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
  });
});
