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

describe('POST /api/v1/reception/appointments', () => {
  it('books for an existing patient', async () => {
    const { fixture, dateObj } = await setupBookableDoctor();
    const patient = await createPatientFixture(app);
    const reception = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.APPOINTMENT_MANAGE]);
    const slot = atTime(dateObj, '09:00');

    const res = await request(app)
      .post('/api/v1/reception/appointments')
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC', appointmentType: 'NEW_CONSULTATION' });

    expect(res.status).toBe(201);
    expect(res.body.data.appointment.bookingSource).toBe('RECEPTION');
  });

  it('books for a brand-new patient (no prior relationship with the clinic)', async () => {
    const { fixture, dateObj } = await setupBookableDoctor();
    const reception = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.APPOINTMENT_MANAGE]);
    const slot = atTime(dateObj, '09:00');

    const res = await request(app)
      .post('/api/v1/reception/appointments')
      .set('Authorization', `Bearer ${reception.token}`)
      .send({
        newPatient: { fullName: 'Brand New Patient', phone: '+919876500001' },
        doctorId: fixture.doctorId,
        clinicId: fixture.clinicId,
        scheduledAt: slot.toISOString(),
        consultationType: 'IN_CLINIC',
        appointmentType: 'NEW_CONSULTATION',
      });

    expect(res.status).toBe(201);
  });

  it('rejects without APPOINTMENT_MANAGE permission', async () => {
    const { fixture, dateObj } = await setupBookableDoctor();
    const patient = await createPatientFixture(app);
    const reception = await createReceptionFixture(app, fixture.clinicId, []);
    const slot = atTime(dateObj, '09:00');

    const res = await request(app)
      .post('/api/v1/reception/appointments')
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC', appointmentType: 'NEW_CONSULTATION' });
    expect(res.status).toBe(403);
  });

  it('rejects a receptionist acting on a clinic they are not staff at', async () => {
    const { fixture, dateObj } = await setupBookableDoctor();
    const otherFixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const foreignReception = await createReceptionFixture(app, otherFixture.clinicId, [CLINIC_PERMISSIONS.APPOINTMENT_MANAGE]);
    const slot = atTime(dateObj, '09:00');

    const res = await request(app)
      .post('/api/v1/reception/appointments')
      .set('Authorization', `Bearer ${foreignReception.token}`)
      .send({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC', appointmentType: 'NEW_CONSULTATION' });
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/v1/reception/appointments/:id/reschedule', () => {
  it('reschedules an appointment', async () => {
    const { fixture, dateObj } = await setupBookableDoctor();
    const patient = await createPatientFixture(app);
    const reception = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.APPOINTMENT_MANAGE]);
    const oldSlot = atTime(dateObj, '09:00');
    const newSlot = atTime(dateObj, '09:30');
    const appointment = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: oldSlot, status: 'CONFIRMED' });

    const res = await request(app)
      .patch(`/api/v1/reception/appointments/${appointment.id}/reschedule?clinicId=${fixture.clinicId}`)
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ newScheduledAt: newSlot.toISOString() });
    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/v1/reception/appointments/:id/cancel', () => {
  it('cancels an appointment and records reception as the source', async () => {
    const { fixture, dateObj } = await setupBookableDoctor();
    const patient = await createPatientFixture(app);
    const reception = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.APPOINTMENT_MANAGE]);
    const slot = atTime(dateObj, '09:00');
    const appointment = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot, status: 'CONFIRMED' });

    const res = await request(app)
      .patch(`/api/v1/reception/appointments/${appointment.id}/cancel?clinicId=${fixture.clinicId}`)
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ reason: 'Patient called to cancel' });
    expect(res.status).toBe(200);

    const cancelled = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancelSource).toBe('RECEPTION');
    expect(cancelled.cancelledByUserId).toBe(reception.userId);
    expect(cancelled.previousStatusBeforeCancel).toBe('CONFIRMED');
  });
});

describe('PATCH /api/v1/reception/appointments/:id/no-show', () => {
  it('marks an appointment no-show by delegating to the existing doctor-appointments engine', async () => {
    const { fixture, dateObj } = await setupBookableDoctor();
    const patient = await createPatientFixture(app);
    const reception = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.APPOINTMENT_MANAGE]);
    const slot = atTime(dateObj, '09:00');
    const appointment = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot, status: 'CONFIRMED' });

    const res = await request(app)
      .patch(`/api/v1/reception/appointments/${appointment.id}/no-show`)
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ clinicId: fixture.clinicId });
    expect(res.status).toBe(200);

    const updated = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(updated.status).toBe('NO_SHOW');
  });
});
