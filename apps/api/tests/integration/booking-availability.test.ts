import { describe, expect, it } from 'vitest';
import request from 'supertest';

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
const { prisma } = await import('../../src/config/database.js');
const { findForbiddenKeys } = await import('../helpers/assert-no-pii.js');

const app = createApp();

async function setupBookableDoctor(overrides?: { durationMinutes?: number; bufferMinutes?: number }) {
  const fixture = await createDoctorFixture(app);
  const { date, weekday, dateObj } = tomorrowInfo();
  await createClinicWorkingHoursFixture(fixture.clinicId, { weekday, sessions: [{ startTime: '09:00', endTime: '13:00' }] });
  await createDoctorAvailabilityFixture(fixture.clinicDoctorId, {
    weekday,
    startTime: '09:00',
    endTime: '13:00',
    consultationDurationMinutes: overrides?.durationMinutes ?? 15,
  });
  if (overrides?.bufferMinutes !== undefined) {
    await prisma.clinicSettings.upsert({
      where: { clinicId: fixture.clinicId },
      update: { bufferMinutes: overrides.bufferMinutes },
      create: { clinicId: fixture.clinicId, bufferMinutes: overrides.bufferMinutes },
    });
  }
  return { fixture, date, weekday, dateObj };
}

describe('GET /api/v1/appointments/availability', () => {
  it('generates a full grid of AVAILABLE slots respecting duration', async () => {
    const { fixture, date } = await setupBookableDoctor({ durationMinutes: 15 });
    const res = await request(app).get(`/api/v1/appointments/availability?doctorId=${fixture.doctorId}&clinicId=${fixture.clinicId}&date=${date}`);

    expect(res.status).toBe(200);
    expect(res.body.data.closedReason).toBeNull();
    expect(res.body.data.slots.length).toBe(16); // 09:00-13:00 in 15-min steps
    expect(res.body.data.slots.every((s: { status: string }) => s.status === 'AVAILABLE')).toBe(true);
    expect(res.body.data.slots[0].durationMinutes).toBe(15);
  });

  it('accounts for buffer time between slots', async () => {
    const { fixture, date } = await setupBookableDoctor({ durationMinutes: 15, bufferMinutes: 5 });
    const res = await request(app).get(`/api/v1/appointments/availability?doctorId=${fixture.doctorId}&clinicId=${fixture.clinicId}&date=${date}`);

    expect(res.status).toBe(200);
    const [first, second] = res.body.data.slots;
    const gapMinutes = (new Date(second.startAt).getTime() - new Date(first.startAt).getTime()) / 60_000;
    expect(gapMinutes).toBe(20); // 15 min consultation + 5 min buffer
  });

  it('marks a slot BOOKED when an existing appointment occupies it', async () => {
    const { fixture, date, dateObj } = await setupBookableDoctor({ durationMinutes: 15 });
    const patient = await createPatientFixture(app);
    const slot = atTime(dateObj, '09:00');
    await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot, status: 'CONFIRMED' });

    const res = await request(app).get(`/api/v1/appointments/availability?doctorId=${fixture.doctorId}&clinicId=${fixture.clinicId}&date=${date}`);
    const bookedSlot = res.body.data.slots.find((s: { startAt: string }) => new Date(s.startAt).getTime() === slot.getTime());
    expect(bookedSlot.status).toBe('BOOKED');
  });

  it('does not count a cancelled appointment as occupying its slot', async () => {
    const { fixture, date, dateObj } = await setupBookableDoctor({ durationMinutes: 15 });
    const patient = await createPatientFixture(app);
    const slot = atTime(dateObj, '09:00');
    await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot, status: 'CANCELLED' });

    const res = await request(app).get(`/api/v1/appointments/availability?doctorId=${fixture.doctorId}&clinicId=${fixture.clinicId}&date=${date}`);
    const freeSlot = res.body.data.slots.find((s: { startAt: string }) => new Date(s.startAt).getTime() === slot.getTime());
    expect(freeSlot.status).toBe('AVAILABLE');
  });

  it('returns DOCTOR_ON_LEAVE and no slots when the doctor is on leave', async () => {
    const { fixture, date, dateObj } = await setupBookableDoctor();
    const dateOnly = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
    await prisma.doctorLeave.create({ data: { doctorId: fixture.doctorId, clinicId: fixture.clinicId, startDate: dateOnly, endDate: dateOnly, type: 'LEAVE' } });

    const res = await request(app).get(`/api/v1/appointments/availability?doctorId=${fixture.doctorId}&clinicId=${fixture.clinicId}&date=${date}`);
    expect(res.body.data.closedReason).toBe('DOCTOR_ON_LEAVE');
    expect(res.body.data.slots.length).toBe(0);
  });

  it('returns CLINIC_HOLIDAY and no slots on a full-day clinic holiday', async () => {
    const { fixture, date, dateObj } = await setupBookableDoctor();
    const dateOnly = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
    await prisma.clinicHoliday.create({ data: { clinicId: fixture.clinicId, date: dateOnly, name: 'Test Holiday', isFullDay: true } });

    const res = await request(app).get(`/api/v1/appointments/availability?doctorId=${fixture.doctorId}&clinicId=${fixture.clinicId}&date=${date}`);
    expect(res.body.data.closedReason).toBe('CLINIC_HOLIDAY');
    expect(res.body.data.slots.length).toBe(0);
  });

  it('returns CLINIC_CLOSED when the clinic has no working hours for that weekday', async () => {
    const fixture = await createDoctorFixture(app);
    const { date, weekday } = tomorrowInfo();
    await createDoctorAvailabilityFixture(fixture.clinicDoctorId, { weekday, startTime: '09:00', endTime: '13:00' });
    // No ClinicWorkingHours row created at all for this clinic/weekday.

    const res = await request(app).get(`/api/v1/appointments/availability?doctorId=${fixture.doctorId}&clinicId=${fixture.clinicId}&date=${date}`);
    expect(res.body.data.closedReason).toBe('CLINIC_CLOSED');
  });

  it('returns NO_SESSIONS_TODAY when the doctor has no availability template for that weekday', async () => {
    const fixture = await createDoctorFixture(app);
    const { date, weekday } = tomorrowInfo();
    await createClinicWorkingHoursFixture(fixture.clinicId, { weekday, sessions: [{ startTime: '09:00', endTime: '13:00' }] });
    // No DoctorAvailability row created.

    const res = await request(app).get(`/api/v1/appointments/availability?doctorId=${fixture.doctorId}&clinicId=${fixture.clinicId}&date=${date}`);
    expect(res.body.data.closedReason).toBe('NO_SESSIONS_TODAY');
  });

  it('rejects a query with a missing required parameter', async () => {
    const res = await request(app).get('/api/v1/appointments/availability?clinicId=00000000-0000-0000-0000-000000000000&date=2026-08-20');
    expect(res.status).toBe(400);
  });

  it('is public — no authentication required', async () => {
    const { fixture, date } = await setupBookableDoctor();
    const res = await request(app).get(`/api/v1/appointments/availability?doctorId=${fixture.doctorId}&clinicId=${fixture.clinicId}&date=${date}`);
    expect(res.status).toBe(200);
  });

  it('never leaks patient-identifying data', async () => {
    const { fixture, date, dateObj } = await setupBookableDoctor();
    const patient = await createPatientFixture(app);
    const slot = atTime(dateObj, '09:00');
    await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot, status: 'CONFIRMED' });

    const res = await request(app).get(`/api/v1/appointments/availability?doctorId=${fixture.doctorId}&clinicId=${fixture.clinicId}&date=${date}`);
    expect(findForbiddenKeys(res.body)).toEqual([]);
  });
});
