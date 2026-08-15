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

const app = createApp();

async function setupBookableDoctor() {
  const fixture = await createDoctorFixture(app);
  const { date, weekday, dateObj } = tomorrowInfo();
  await createClinicWorkingHoursFixture(fixture.clinicId, { weekday, sessions: [{ startTime: '09:00', endTime: '13:00' }] });
  await createDoctorAvailabilityFixture(fixture.clinicDoctorId, { weekday, startTime: '09:00', endTime: '13:00', consultationDurationMinutes: 15 });
  return { fixture, date, dateObj };
}

describe('PATCH /api/v1/appointments/:id/reschedule', () => {
  it('reschedules to a new slot, freeing the old one and occupying the new one', async () => {
    const { fixture, date, dateObj } = await setupBookableDoctor();
    const patient = await createPatientFixture(app);
    const oldSlot = atTime(dateObj, '09:00');
    const newSlot = atTime(dateObj, '09:30');

    const appointment = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: oldSlot, status: 'CONFIRMED' });

    const res = await request(app)
      .patch(`/api/v1/appointments/${appointment.id}/reschedule`)
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ newScheduledAt: newSlot.toISOString(), reason: 'Schedule conflict' });

    expect(res.status).toBe(200);
    expect(res.body.data.appointment.scheduledAt).toBe(newSlot.toISOString());

    const updated = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(updated.previousScheduledAt?.getTime()).toBe(oldSlot.getTime());
    expect(updated.rescheduleCount).toBe(1);
    expect(updated.rescheduleReason).toBe('Schedule conflict');

    const availRes = await request(app).get(`/api/v1/appointments/availability?doctorId=${fixture.doctorId}&clinicId=${fixture.clinicId}&date=${date}`);
    const oldSlotStatus = availRes.body.data.slots.find((s: { startAt: string }) => new Date(s.startAt).getTime() === oldSlot.getTime());
    const newSlotStatus = availRes.body.data.slots.find((s: { startAt: string }) => new Date(s.startAt).getTime() === newSlot.getTime());
    expect(oldSlotStatus.status).toBe('AVAILABLE');
    expect(newSlotStatus.status).toBe('BOOKED');
  });

  it('reschedules via a pre-held slot', async () => {
    const { fixture, dateObj } = await setupBookableDoctor();
    const patient = await createPatientFixture(app);
    const oldSlot = atTime(dateObj, '09:00');
    const newSlot = atTime(dateObj, '10:00');
    const appointment = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: oldSlot, status: 'CONFIRMED' });

    const holdRes = await request(app)
      .post('/api/v1/appointments/hold')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: newSlot.toISOString(), consultationType: 'IN_CLINIC' });
    expect(holdRes.status).toBe(201);

    const res = await request(app)
      .patch(`/api/v1/appointments/${appointment.id}/reschedule`)
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ newScheduledAt: newSlot.toISOString(), holdId: holdRes.body.data.hold.id });
    expect(res.status).toBe(200);
  });

  it('rejects rescheduling into an already-occupied slot', async () => {
    const { fixture, dateObj } = await setupBookableDoctor();
    const patientA = await createPatientFixture(app);
    const patientB = await createPatientFixture(app);
    const slotA = atTime(dateObj, '09:00');
    const slotB = atTime(dateObj, '09:15');

    const appointmentA = await createAppointmentFixture({ patientId: patientA.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slotA, status: 'CONFIRMED' });
    await createAppointmentFixture({ patientId: patientB.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slotB, status: 'CONFIRMED' });

    const res = await request(app)
      .patch(`/api/v1/appointments/${appointmentA.id}/reschedule`)
      .set('Authorization', `Bearer ${patientA.token}`)
      .send({ newScheduledAt: slotB.toISOString() });
    expect(res.status).toBe(409);
  });

  it('rejects rescheduling a checked-in appointment', async () => {
    const { fixture, dateObj } = await setupBookableDoctor();
    const patient = await createPatientFixture(app);
    const slot = atTime(dateObj, '09:00');
    const newSlot = atTime(dateObj, '09:30');
    const appointment = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot, status: 'CHECKED_IN' });

    const res = await request(app)
      .patch(`/api/v1/appointments/${appointment.id}/reschedule`)
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ newScheduledAt: newSlot.toISOString() });
    expect(res.status).toBe(409);
  });

  it('rejects rescheduling another patient\'s appointment (IDOR)', async () => {
    const { fixture, dateObj } = await setupBookableDoctor();
    const owner = await createPatientFixture(app);
    const attacker = await createPatientFixture(app);
    const slot = atTime(dateObj, '09:00');
    const newSlot = atTime(dateObj, '09:30');
    const appointment = await createAppointmentFixture({ patientId: owner.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot, status: 'CONFIRMED' });

    const res = await request(app)
      .patch(`/api/v1/appointments/${appointment.id}/reschedule`)
      .set('Authorization', `Bearer ${attacker.token}`)
      .send({ newScheduledAt: newSlot.toISOString() });
    expect(res.status).toBe(404);
  });
});
