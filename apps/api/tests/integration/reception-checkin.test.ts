import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ALL_CLINIC_PERMISSIONS } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

function randomPhone(): string {
  return `+91${Math.floor(7000000000 + Math.random() * 900000000)}`;
}

let doctor: Awaited<ReturnType<typeof createDoctorFixture>>;
let reception: Awaited<ReturnType<typeof createReceptionFixture>>;

beforeAll(async () => {
  doctor = await createDoctorFixture(app);
  reception = await createReceptionFixture(app, doctor.clinicId, ALL_CLINIC_PERMISSIONS);
});

describe('Patient check-in', () => {
  it('checks in a confirmed appointment and creates a WAITING queue token', async () => {
    const patient = await createPatientFixture(app);
    const appointment = await createAppointmentFixture({ patientId: patient.patientId, doctorId: doctor.doctorId, clinicId: doctor.clinicId, status: 'CONFIRMED' });

    const res = await request(app)
      .post('/api/v1/reception/checkin')
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ appointmentId: appointment.id });
    expect(res.status).toBe(200);
    expect(res.body.data.token.status).toBe('WAITING');

    const updated = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(updated.status).toBe('CHECKED_IN');
  });

  it('rejects a second check-in for the same appointment', async () => {
    const patient = await createPatientFixture(app);
    const appointment = await createAppointmentFixture({ patientId: patient.patientId, doctorId: doctor.doctorId, clinicId: doctor.clinicId, status: 'CONFIRMED' });

    const first = await request(app).post('/api/v1/reception/checkin').set('Authorization', `Bearer ${reception.token}`).send({ appointmentId: appointment.id });
    expect(first.status).toBe(200);

    const second = await request(app).post('/api/v1/reception/checkin').set('Authorization', `Bearer ${reception.token}`).send({ appointmentId: appointment.id });
    expect(second.status).toBe(409);
  });

  it('rejects check-in for a cancelled appointment', async () => {
    const patient = await createPatientFixture(app);
    const appointment = await createAppointmentFixture({ patientId: patient.patientId, doctorId: doctor.doctorId, clinicId: doctor.clinicId, status: 'CANCELLED' });

    const res = await request(app).post('/api/v1/reception/checkin').set('Authorization', `Bearer ${reception.token}`).send({ appointmentId: appointment.id });
    expect(res.status).toBe(409);
  });

  it('rejects check-in without the patient.checkin permission', async () => {
    const noPerm = await createReceptionFixture(app, doctor.clinicId, []);
    const patient = await createPatientFixture(app);
    const appointment = await createAppointmentFixture({ patientId: patient.patientId, doctorId: doctor.doctorId, clinicId: doctor.clinicId, status: 'CONFIRMED' });

    const res = await request(app).post('/api/v1/reception/checkin').set('Authorization', `Bearer ${noPerm.token}`).send({ appointmentId: appointment.id });
    expect(res.status).toBe(403);
  });
});

describe('Walk-in registration', () => {
  it('registers a brand-new walk-in patient and checks them in immediately', async () => {
    const res = await request(app)
      .post('/api/v1/reception/walkin')
      .set('Authorization', `Bearer ${reception.token}`)
      .send({
        clinicId: doctor.clinicId,
        doctorId: doctor.doctorId,
        fullName: 'Walk In Patient',
        phone: randomPhone(),
        reasonForVisit: 'Fever',
        paymentStatus: 'PENDING',
        priority: 'NORMAL',
      });
    expect(res.status).toBe(200);
    expect(res.body.data.token.type).toBe('WALK_IN');
    expect(res.body.data.token.status).toBe('WAITING');
  });

  it('links an existing patient by phone instead of creating a duplicate account', async () => {
    const patient = await createPatientFixture(app);
    const phone = randomPhone();
    await prisma.user.update({ where: { id: patient.userId }, data: { phone } });

    const beforePatientCount = await prisma.patient.count();

    const res = await request(app)
      .post('/api/v1/reception/walkin')
      .set('Authorization', `Bearer ${reception.token}`)
      .send({
        clinicId: doctor.clinicId,
        doctorId: doctor.doctorId,
        fullName: 'Should Be Ignored',
        phone,
        paymentStatus: 'PENDING',
        priority: 'NORMAL',
      });
    expect(res.status).toBe(200);

    const afterPatientCount = await prisma.patient.count();
    expect(afterPatientCount).toBe(beforePatientCount);

    const appointment = await prisma.appointment.findUniqueOrThrow({ where: { id: res.body.data.appointmentId } });
    expect(appointment.patientId).toBe(patient.patientId);
  });

  it('rejects walk-in registration without the patient.walkin.create permission', async () => {
    const noPerm = await createReceptionFixture(app, doctor.clinicId, []);
    const res = await request(app)
      .post('/api/v1/reception/walkin')
      .set('Authorization', `Bearer ${noPerm.token}`)
      .send({
        clinicId: doctor.clinicId,
        doctorId: doctor.doctorId,
        fullName: 'No Permission Patient',
        phone: randomPhone(),
        paymentStatus: 'PENDING',
        priority: 'NORMAL',
      });
    expect(res.status).toBe(403);
  });

  it('requires either an existing patient or a name + phone', async () => {
    const res = await request(app)
      .post('/api/v1/reception/walkin')
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ clinicId: doctor.clinicId, doctorId: doctor.doctorId, paymentStatus: 'PENDING', priority: 'NORMAL' });
    expect(res.status).toBe(400);
  });
});
