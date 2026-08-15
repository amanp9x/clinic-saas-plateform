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

interface Fixture {
  token: string;
  userId: string;
  doctorId: string;
  clinicId: string;
  clinicDoctorId: string;
}

async function setupBookableDoctor(): Promise<{ fixture: Fixture; slot: Date; date: string }> {
  const fixture = await createDoctorFixture(app);
  const { date, weekday, dateObj } = tomorrowInfo();
  await createClinicWorkingHoursFixture(fixture.clinicId, { weekday, sessions: [{ startTime: '09:00', endTime: '17:00' }] });
  await createDoctorAvailabilityFixture(fixture.clinicDoctorId, { weekday, startTime: '09:00', endTime: '17:00', consultationDurationMinutes: 15 });
  const slot = atTime(dateObj, '09:00');
  return { fixture, slot, date };
}

describe('POST /api/v1/appointments/hold', () => {
  it('holds an available slot', async () => {
    const { fixture, slot } = await setupBookableDoctor();
    const patient = await createPatientFixture(app);

    const res = await request(app)
      .post('/api/v1/appointments/hold')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC' });

    expect(res.status).toBe(201);
    expect(res.body.data.hold.durationMinutes).toBe(15);
    expect(new Date(res.body.data.hold.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects holding an already-booked slot', async () => {
    const { fixture, slot } = await setupBookableDoctor();
    const patientA = await createPatientFixture(app);
    const patientB = await createPatientFixture(app);

    const holdRes = await request(app)
      .post('/api/v1/appointments/hold')
      .set('Authorization', `Bearer ${patientA.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC' });
    await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patientA.token}`)
      .send({ holdId: holdRes.body.data.hold.id, appointmentType: 'NEW_CONSULTATION' });

    const res = await request(app)
      .post('/api/v1/appointments/hold')
      .set('Authorization', `Bearer ${patientB.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC' });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/v1/appointments', () => {
  it('books directly without a prior hold', async () => {
    const { fixture, slot } = await setupBookableDoctor();
    const patient = await createPatientFixture(app);

    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC', appointmentType: 'NEW_CONSULTATION' });

    expect(res.status).toBe(201);
    expect(res.body.data.appointment.bookingReference).toMatch(/^APT-\d{8}-[A-Z0-9]{5}$/);
    expect(res.body.data.appointment.durationMinutes).toBe(15);
    expect(res.body.data.appointment.consultationFee).toBe('500');
    expect(res.body.data.appointment.bookingSource).toBe('PATIENT');
    expect(res.body.data.appointment.status).toBe('CONFIRMED');
  });

  it('confirms a held slot into a booking', async () => {
    const { fixture, slot } = await setupBookableDoctor();
    const patient = await createPatientFixture(app);

    const holdRes = await request(app)
      .post('/api/v1/appointments/hold')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC' });

    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ holdId: holdRes.body.data.hold.id, appointmentType: 'FOLLOW_UP' });

    expect(res.status).toBe(201);
    expect(res.body.data.appointment.appointmentType).toBe('FOLLOW_UP');

    const hold = await prisma.slotHold.findUnique({ where: { id: holdRes.body.data.hold.id } });
    expect(hold?.status).toBe('RELEASED');
  });

  it('never trusts a client-supplied bookingSource', async () => {
    const { fixture, slot } = await setupBookableDoctor();
    const patient = await createPatientFixture(app);

    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({
        doctorId: fixture.doctorId,
        clinicId: fixture.clinicId,
        scheduledAt: slot.toISOString(),
        consultationType: 'IN_CLINIC',
        appointmentType: 'NEW_CONSULTATION',
        bookingSource: 'RECEPTION',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.appointment.bookingSource).toBe('PATIENT');
  });

  it('rejects an expired, unconfirmed hold', async () => {
    const { fixture, slot } = await setupBookableDoctor();
    const patient = await createPatientFixture(app);

    const holdRes = await request(app)
      .post('/api/v1/appointments/hold')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC' });
    await prisma.slotHold.update({ where: { id: holdRes.body.data.hold.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ holdId: holdRes.body.data.hold.id, appointmentType: 'NEW_CONSULTATION' });
    expect(res.status).toBe(409);
  });

  it('rejects FOLLOW_UP/EMERGENCY as a consultationType input', async () => {
    const { fixture, slot } = await setupBookableDoctor();
    const patient = await createPatientFixture(app);

    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'EMERGENCY', appointmentType: 'NEW_CONSULTATION' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/v1/appointments/hold/:id', () => {
  it('releases a hold, freeing the slot for another patient', async () => {
    const { fixture, slot } = await setupBookableDoctor();
    const patientA = await createPatientFixture(app);
    const patientB = await createPatientFixture(app);

    const holdRes = await request(app)
      .post('/api/v1/appointments/hold')
      .set('Authorization', `Bearer ${patientA.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC' });

    const releaseRes = await request(app)
      .delete(`/api/v1/appointments/hold/${holdRes.body.data.hold.id}`)
      .set('Authorization', `Bearer ${patientA.token}`);
    expect(releaseRes.status).toBe(200);

    const bookRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patientB.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC', appointmentType: 'NEW_CONSULTATION' });
    expect(bookRes.status).toBe(201);
  });

  it('is idempotent — releasing an already-released hold is a no-op, not an error', async () => {
    const { fixture, slot } = await setupBookableDoctor();
    const patient = await createPatientFixture(app);
    const holdRes = await request(app)
      .post('/api/v1/appointments/hold')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC' });

    await request(app).delete(`/api/v1/appointments/hold/${holdRes.body.data.hold.id}`).set('Authorization', `Bearer ${patient.token}`);
    const res = await request(app).delete(`/api/v1/appointments/hold/${holdRes.body.data.hold.id}`).set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(200);
  });
});

describe('Concurrency safety', () => {
  it('(A) two patients booking the identical slot concurrently — exactly one succeeds', async () => {
    const { fixture, slot } = await setupBookableDoctor();
    const patientA = await createPatientFixture(app);
    const patientB = await createPatientFixture(app);

    const body = { doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC', appointmentType: 'NEW_CONSULTATION' };
    const [resA, resB] = await Promise.all([
      request(app).post('/api/v1/appointments').set('Authorization', `Bearer ${patientA.token}`).send(body),
      request(app).post('/api/v1/appointments').set('Authorization', `Bearer ${patientB.token}`).send(body),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);

    const booked = await prisma.appointment.findMany({
      where: { doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot, status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
    });
    expect(booked.length).toBe(1);
  });

  it('(B) reception and a patient racing the identical slot — exactly one succeeds', async () => {
    const { fixture, slot } = await setupBookableDoctor();
    const patient = await createPatientFixture(app);
    const reception = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.APPOINTMENT_MANAGE]);
    const otherPatient = await createPatientFixture(app);

    const [patientRes, receptionRes] = await Promise.all([
      request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${patient.token}`)
        .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC', appointmentType: 'NEW_CONSULTATION' }),
      request(app)
        .post('/api/v1/reception/appointments')
        .set('Authorization', `Bearer ${reception.token}`)
        .send({ patientId: otherPatient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC', appointmentType: 'NEW_CONSULTATION' }),
    ]);

    const statuses = [patientRes.status, receptionRes.status].sort();
    expect(statuses).toEqual([201, 409]);

    const booked = await prisma.appointment.count({
      where: { doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot, status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
    });
    expect(booked).toBe(1);
  });

  it('(C) a hold that has expired does not block a concurrent direct booking, and the stale hold cannot later confirm', async () => {
    const { fixture, slot } = await setupBookableDoctor();
    const patientA = await createPatientFixture(app);
    const patientB = await createPatientFixture(app);

    const holdRes = await request(app)
      .post('/api/v1/appointments/hold')
      .set('Authorization', `Bearer ${patientA.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC' });
    expect(holdRes.status).toBe(201);
    await prisma.slotHold.update({ where: { id: holdRes.body.data.hold.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const [confirmA, directB] = await Promise.all([
      request(app).post('/api/v1/appointments').set('Authorization', `Bearer ${patientA.token}`).send({ holdId: holdRes.body.data.hold.id, appointmentType: 'NEW_CONSULTATION' }),
      request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${patientB.token}`)
        .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC', appointmentType: 'NEW_CONSULTATION' }),
    ]);

    const statuses = [confirmA.status, directB.status].sort();
    expect(statuses).toEqual([201, 409]);

    const booked = await prisma.appointment.findMany({
      where: { doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot, status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
    });
    expect(booked.length).toBe(1);

    const staleHolds = await prisma.slotHold.findMany({
      where: { doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot, status: 'ACTIVE', expiresAt: { gt: new Date() } },
    });
    expect(staleHolds.length).toBe(0);
  });

  it('(D) a leave added after a hold was created blocks confirmation of that hold', async () => {
    const { fixture, slot } = await setupBookableDoctor();
    const patient = await createPatientFixture(app);

    const holdRes = await request(app)
      .post('/api/v1/appointments/hold')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC' });
    expect(holdRes.status).toBe(201);

    const dateOnly = new Date(Date.UTC(slot.getFullYear(), slot.getMonth(), slot.getDate()));
    await prisma.doctorLeave.create({
      data: { doctorId: fixture.doctorId, clinicId: fixture.clinicId, startDate: dateOnly, endDate: dateOnly, type: 'LEAVE' },
    });

    const confirmRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ holdId: holdRes.body.data.hold.id, appointmentType: 'NEW_CONSULTATION' });
    expect(confirmRes.status).toBe(409);

    const booked = await prisma.appointment.count({
      where: { doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot, status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
    });
    expect(booked).toBe(0);
  });
});
