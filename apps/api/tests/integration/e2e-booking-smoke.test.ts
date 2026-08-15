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
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

describe('End-to-end booking smoke test', () => {
  it('patient books → reception checks in → doctor starts → doctor completes, reaching COMPLETED', async () => {
    const fixture = await createDoctorFixture(app);
    const { date, weekday, dateObj } = tomorrowInfo();
    await createClinicWorkingHoursFixture(fixture.clinicId, { weekday, sessions: [{ startTime: '09:00', endTime: '13:00' }] });
    await createDoctorAvailabilityFixture(fixture.clinicDoctorId, { weekday, startTime: '09:00', endTime: '13:00', consultationDurationMinutes: 15 });
    const slot = atTime(dateObj, '09:00');

    const patient = await createPatientFixture(app);
    const reception = await createReceptionFixture(app, fixture.clinicId, [
      CLINIC_PERMISSIONS.APPOINTMENT_MANAGE,
      CLINIC_PERMISSIONS.QUEUE_VIEW,
      CLINIC_PERMISSIONS.PATIENT_CHECKIN,
    ]);

    // 1. Patient searches (availability) and books.
    const availRes = await request(app).get(`/api/v1/appointments/availability?doctorId=${fixture.doctorId}&clinicId=${fixture.clinicId}&date=${date}`);
    expect(availRes.status).toBe(200);
    expect(availRes.body.data.slots[0].status).toBe('AVAILABLE');

    const bookRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC', appointmentType: 'NEW_CONSULTATION' });
    expect(bookRes.status).toBe(201);
    const appointmentId = bookRes.body.data.appointment.id;
    expect(bookRes.body.data.appointment.bookingReference).toMatch(/^APT-/);

    // 2. Appears in Patient Portal.
    const patientListRes = await request(app).get('/api/v1/appointments?tab=upcoming').set('Authorization', `Bearer ${patient.token}`);
    expect(patientListRes.body.data.items.some((a: { id: string }) => a.id === appointmentId)).toBe(true);

    // 3. Appears in Reception.
    const receptionListRes = await request(app)
      .get(`/api/v1/reception/appointments?clinicId=${fixture.clinicId}&tab=upcoming`)
      .set('Authorization', `Bearer ${reception.token}`);
    expect(receptionListRes.body.data.appointments.items.some((a: { id: string }) => a.id === appointmentId)).toBe(true);

    // 4. Appears in Doctor Portal.
    const doctorListRes = await request(app).get('/api/v1/doctor/appointments?tab=upcoming').set('Authorization', `Bearer ${fixture.token}`);
    expect(doctorListRes.body.data.items.some((a: { id: string }) => a.id === appointmentId)).toBe(true);

    // 5. Reception checks in — CONFIRMED -> CHECKED_IN, QueueToken created.
    const checkinRes = await request(app)
      .post('/api/v1/reception/checkin')
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ appointmentId });
    expect(checkinRes.status).toBe(200);

    let current = await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId } });
    expect(current.status).toBe('CHECKED_IN');
    const token = await prisma.queueToken.findUnique({ where: { appointmentId } });
    expect(token).not.toBeNull();
    expect(token?.status).toBe('WAITING');

    // 6. Doctor starts consultation — CHECKED_IN -> IN_CONSULTATION.
    const startRes = await request(app).post(`/api/v1/doctor/appointments/${appointmentId}/start`).set('Authorization', `Bearer ${fixture.token}`);
    expect(startRes.status).toBe(200);
    current = await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId } });
    expect(current.status).toBe('IN_CONSULTATION');

    // 7. Doctor completes consultation — IN_CONSULTATION -> COMPLETED.
    const completeRes = await request(app).post(`/api/v1/doctor/consultations/${appointmentId}/complete`).set('Authorization', `Bearer ${fixture.token}`);
    expect(completeRes.status).toBe(200);

    current = await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentId } });
    expect(current.status).toBe('COMPLETED');
    const finalToken = await prisma.queueToken.findUnique({ where: { appointmentId } });
    expect(finalToken?.status).toBe('COMPLETED');
  });

  it('supports patient cancellation before check-in', async () => {
    const fixture = await createDoctorFixture(app);
    const { weekday, dateObj } = tomorrowInfo();
    await createClinicWorkingHoursFixture(fixture.clinicId, { weekday, sessions: [{ startTime: '09:00', endTime: '13:00' }] });
    await createDoctorAvailabilityFixture(fixture.clinicDoctorId, { weekday, startTime: '09:00', endTime: '13:00', consultationDurationMinutes: 15 });
    const slot = atTime(dateObj, '09:00');
    const patient = await createPatientFixture(app);

    const bookRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC', appointmentType: 'NEW_CONSULTATION' });
    const appointmentId = bookRes.body.data.appointment.id;

    const cancelRes = await request(app)
      .post(`/api/v1/appointments/${appointmentId}/cancel`)
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ reason: 'No longer needed' });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.appointment.status).toBe('CANCELLED');

    const freed = await request(app).get(
      `/api/v1/appointments/availability?doctorId=${fixture.doctorId}&clinicId=${fixture.clinicId}&date=${tomorrowInfo().date}`,
    );
    const slotStatus = freed.body.data.slots.find((s: { startAt: string }) => new Date(s.startAt).getTime() === slot.getTime());
    expect(slotStatus.status).toBe('AVAILABLE');
  });

  it('supports patient reschedule end to end', async () => {
    const fixture = await createDoctorFixture(app);
    const { weekday, dateObj } = tomorrowInfo();
    await createClinicWorkingHoursFixture(fixture.clinicId, { weekday, sessions: [{ startTime: '09:00', endTime: '13:00' }] });
    await createDoctorAvailabilityFixture(fixture.clinicDoctorId, { weekday, startTime: '09:00', endTime: '13:00', consultationDurationMinutes: 15 });
    const slot = atTime(dateObj, '09:00');
    const newSlot = atTime(dateObj, '10:00');
    const patient = await createPatientFixture(app);

    const bookRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC', appointmentType: 'NEW_CONSULTATION' });
    const appointmentId = bookRes.body.data.appointment.id;

    const rescheduleRes = await request(app)
      .patch(`/api/v1/appointments/${appointmentId}/reschedule`)
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ newScheduledAt: newSlot.toISOString() });
    expect(rescheduleRes.status).toBe(200);
    expect(rescheduleRes.body.data.appointment.scheduledAt).toBe(newSlot.toISOString());
  });

  it('a double-booking race resolves to exactly one winner even across the full HTTP surface', async () => {
    const fixture = await createDoctorFixture(app);
    const { weekday, dateObj } = tomorrowInfo();
    await createClinicWorkingHoursFixture(fixture.clinicId, { weekday, sessions: [{ startTime: '09:00', endTime: '13:00' }] });
    await createDoctorAvailabilityFixture(fixture.clinicDoctorId, { weekday, startTime: '09:00', endTime: '13:00', consultationDurationMinutes: 15 });
    const slot = atTime(dateObj, '09:00');
    const patientA = await createPatientFixture(app);
    const patientB = await createPatientFixture(app);
    const patientC = await createPatientFixture(app);

    const body = { doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC', appointmentType: 'NEW_CONSULTATION' };
    const results = await Promise.all([
      request(app).post('/api/v1/appointments').set('Authorization', `Bearer ${patientA.token}`).send(body),
      request(app).post('/api/v1/appointments').set('Authorization', `Bearer ${patientB.token}`).send(body),
      request(app).post('/api/v1/appointments').set('Authorization', `Bearer ${patientC.token}`).send(body),
    ]);

    const successes = results.filter((r) => r.status === 201);
    const conflicts = results.filter((r) => r.status === 409);
    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(2);

    const booked = await prisma.appointment.count({
      where: { doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot, status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
    });
    expect(booked).toBe(1);
  });
});
