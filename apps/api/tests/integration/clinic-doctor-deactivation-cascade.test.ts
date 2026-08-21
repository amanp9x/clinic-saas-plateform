import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { UserRole } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

function futureDate(daysAhead = 2) {
  return new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
}

async function getClinicDoctorId(adminToken: string, clinicId: string, doctorId: string) {
  const res = await request(app).get(`/api/v1/clinic/doctors?clinicId=${clinicId}`).set('Authorization', `Bearer ${adminToken}`);
  const entry = res.body.data.doctors.items.find((d: { doctorId: string }) => d.doctorId === doctorId);
  return entry.clinicDoctorId as string;
}

let clinic: Awaited<ReturnType<typeof createDoctorFixture>>;
let admin: Awaited<ReturnType<typeof createReceptionFixture>>;
let receptionNoPerm: Awaited<ReturnType<typeof createReceptionFixture>>;
let patient: Awaited<ReturnType<typeof createPatientFixture>>;

beforeAll(async () => {
  clinic = await createDoctorFixture(app);
  admin = await createReceptionFixture(app, clinic.clinicId, [], { role: UserRole.CLINIC_ADMIN });
  receptionNoPerm = await createReceptionFixture(app, clinic.clinicId, [], { role: UserRole.RECEPTIONIST });
  patient = await createPatientFixture(app);
});

describe('Authentication and RBAC', () => {
  it('requires authentication for status update', async () => {
    const res = await request(app).patch(`/api/v1/clinic/doctors/${randomUUID()}/status?clinicId=${clinic.clinicId}`).send({ status: 'SUSPENDED' });
    expect(res.status).toBe(401);
  });

  it('requires authentication for removal', async () => {
    const res = await request(app).delete(`/api/v1/clinic/doctors/${randomUUID()}?clinicId=${clinic.clinicId}`);
    expect(res.status).toBe(401);
  });

  it('rejects a receptionist without DOCTOR_MANAGE from changing status', async () => {
    const doctor = await createDoctorFixture(app);
    await request(app)
      .post('/api/v1/clinic/doctors')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, doctorId: doctor.doctorId, consultationTypes: ['IN_CLINIC'] });
    const clinicDoctorId = await getClinicDoctorId(admin.token, clinic.clinicId, doctor.doctorId);

    const res = await request(app)
      .patch(`/api/v1/clinic/doctors/${clinicDoctorId}/status?clinicId=${clinic.clinicId}`)
      .set('Authorization', `Bearer ${receptionNoPerm.token}`)
      .send({ status: 'SUSPENDED' });
    expect(res.status).toBe(403);
  });

  it('rejects a receptionist without DOCTOR_MANAGE from removing an association', async () => {
    const doctor = await createDoctorFixture(app);
    await request(app)
      .post('/api/v1/clinic/doctors')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, doctorId: doctor.doctorId, consultationTypes: ['IN_CLINIC'] });
    const clinicDoctorId = await getClinicDoctorId(admin.token, clinic.clinicId, doctor.doctorId);

    const res = await request(app)
      .delete(`/api/v1/clinic/doctors/${clinicDoctorId}?clinicId=${clinic.clinicId}`)
      .set('Authorization', `Bearer ${receptionNoPerm.token}`);
    expect(res.status).toBe(403);
  });
});

describe('Clinic scoping / IDOR', () => {
  it('404s (not 403) when the clinicDoctorId does not belong to the clinicId in the query', async () => {
    const otherClinicAdmin = await createReceptionFixture(app, (await createDoctorFixture(app)).clinicId, [], { role: UserRole.CLINIC_ADMIN });
    const doctor = await createDoctorFixture(app);
    await request(app)
      .post('/api/v1/clinic/doctors')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, doctorId: doctor.doctorId, consultationTypes: ['IN_CLINIC'] });
    const clinicDoctorId = await getClinicDoctorId(admin.token, clinic.clinicId, doctor.doctorId);

    const res = await request(app)
      .patch(`/api/v1/clinic/doctors/${clinicDoctorId}/status?clinicId=${otherClinicAdmin.clinicId}`)
      .set('Authorization', `Bearer ${otherClinicAdmin.token}`)
      .send({ status: 'SUSPENDED' });
    expect(res.status).toBe(404);
  });
});

describe('Validation', () => {
  it('rejects an invalid status value', async () => {
    const doctor = await createDoctorFixture(app);
    await request(app)
      .post('/api/v1/clinic/doctors')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, doctorId: doctor.doctorId, consultationTypes: ['IN_CLINIC'] });
    const clinicDoctorId = await getClinicDoctorId(admin.token, clinic.clinicId, doctor.doctorId);

    const res = await request(app)
      .patch(`/api/v1/clinic/doctors/${clinicDoctorId}/status?clinicId=${clinic.clinicId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'NOT_A_REAL_STATUS' });
    expect(res.status).toBe(400);
  });

  it('404s for a nonexistent clinicDoctorId', async () => {
    const res = await request(app)
      .patch(`/api/v1/clinic/doctors/${randomUUID()}/status?clinicId=${clinic.clinicId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'SUSPENDED' });
    expect(res.status).toBe(404);
  });
});

describe('Deactivation cascade — status change', () => {
  it('suspending a doctor cancels their future PENDING and CONFIRMED appointments at that clinic, notifies the patient, and leaves past/other-status appointments untouched', async () => {
    const doctor = await createDoctorFixture(app);
    await request(app)
      .post('/api/v1/clinic/doctors')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, doctorId: doctor.doctorId, consultationTypes: ['IN_CLINIC'] });
    const clinicDoctorId = await getClinicDoctorId(admin.token, clinic.clinicId, doctor.doctorId);

    const confirmed = await createAppointmentFixture({
      patientId: patient.patientId,
      doctorId: doctor.doctorId,
      clinicId: clinic.clinicId,
      status: 'CONFIRMED',
      scheduledAt: futureDate(2),
    });
    const pending = await createAppointmentFixture({
      patientId: patient.patientId,
      doctorId: doctor.doctorId,
      clinicId: clinic.clinicId,
      status: 'PENDING',
      scheduledAt: futureDate(3),
    });
    const alreadyCancelled = await createAppointmentFixture({
      patientId: patient.patientId,
      doctorId: doctor.doctorId,
      clinicId: clinic.clinicId,
      status: 'CANCELLED',
      scheduledAt: futureDate(4),
    });
    const completedPast = await createAppointmentFixture({
      patientId: patient.patientId,
      doctorId: doctor.doctorId,
      clinicId: clinic.clinicId,
      status: 'COMPLETED',
      scheduledAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    });

    const res = await request(app)
      .patch(`/api/v1/clinic/doctors/${clinicDoctorId}/status?clinicId=${clinic.clinicId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'SUSPENDED', reason: 'Doctor resigned' });
    expect(res.status).toBe(200);
    expect(res.body.data.doctor.status).toBe('SUSPENDED');
    expect(res.body.data.cancelledAppointmentCount).toBe(2);

    const confirmedRow = await prisma.appointment.findUniqueOrThrow({ where: { id: confirmed.id } });
    expect(confirmedRow.status).toBe('CANCELLED');
    expect(confirmedRow.cancelReason).toBe('Doctor resigned');
    expect(confirmedRow.cancelSource).toBe('RECEPTION');

    const pendingRow = await prisma.appointment.findUniqueOrThrow({ where: { id: pending.id } });
    expect(pendingRow.status).toBe('CANCELLED');

    const cancelledRow = await prisma.appointment.findUniqueOrThrow({ where: { id: alreadyCancelled.id } });
    expect(cancelledRow.status).toBe('CANCELLED');
    expect(cancelledRow.cancelReason).toBeNull();

    const completedRow = await prisma.appointment.findUniqueOrThrow({ where: { id: completedPast.id } });
    expect(completedRow.status).toBe('COMPLETED');

    const confirmedNotif = await prisma.notification.findUnique({ where: { notificationKey: `appointment:${confirmed.id}:cancelled` } });
    expect(confirmedNotif).not.toBeNull();
    expect(confirmedNotif!.userId).toBe(patient.userId);
    const pendingNotif = await prisma.notification.findUnique({ where: { notificationKey: `appointment:${pending.id}:cancelled` } });
    expect(pendingNotif).not.toBeNull();

    const statusAudit = await prisma.auditLog.findFirst({ where: { entityType: 'ClinicDoctor', entityId: clinicDoctorId, action: 'clinic.doctor_status_updated' } });
    expect(statusAudit).not.toBeNull();
    expect((statusAudit!.metadata as { cancelledAppointmentCount: number }).cancelledAppointmentCount).toBe(2);

    const appointmentAudits = await prisma.auditLog.findMany({ where: { entityType: 'Appointment', action: 'appointment.cancelled', entityId: { in: [confirmed.id, pending.id] } } });
    expect(appointmentAudits.length).toBe(2);
  });

  it('reactivating to ACTIVE does not cancel anything', async () => {
    const doctor = await createDoctorFixture(app);
    await request(app)
      .post('/api/v1/clinic/doctors')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, doctorId: doctor.doctorId, consultationTypes: ['IN_CLINIC'] });
    const clinicDoctorId = await getClinicDoctorId(admin.token, clinic.clinicId, doctor.doctorId);

    const confirmed = await createAppointmentFixture({
      patientId: patient.patientId,
      doctorId: doctor.doctorId,
      clinicId: clinic.clinicId,
      status: 'CONFIRMED',
      scheduledAt: futureDate(2),
    });

    const res = await request(app)
      .patch(`/api/v1/clinic/doctors/${clinicDoctorId}/status?clinicId=${clinic.clinicId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'ACTIVE' });
    expect(res.status).toBe(200);
    expect(res.body.data.cancelledAppointmentCount).toBe(0);

    const row = await prisma.appointment.findUniqueOrThrow({ where: { id: confirmed.id } });
    expect(row.status).toBe('CONFIRMED');
  });

  it('does not touch an appointment for the same doctor at a different clinic', async () => {
    const doctor = await createDoctorFixture(app);
    const otherClinic = await createDoctorFixture(app);
    const otherClinicAdmin = await createReceptionFixture(app, otherClinic.clinicId, [], { role: UserRole.CLINIC_ADMIN });

    await request(app)
      .post('/api/v1/clinic/doctors')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, doctorId: doctor.doctorId, consultationTypes: ['IN_CLINIC'] });
    await request(app)
      .post('/api/v1/clinic/doctors')
      .set('Authorization', `Bearer ${otherClinicAdmin.token}`)
      .send({ clinicId: otherClinic.clinicId, doctorId: doctor.doctorId, consultationTypes: ['IN_CLINIC'] });
    const clinicDoctorId = await getClinicDoctorId(admin.token, clinic.clinicId, doctor.doctorId);

    const elsewhere = await createAppointmentFixture({
      patientId: patient.patientId,
      doctorId: doctor.doctorId,
      clinicId: otherClinic.clinicId,
      status: 'CONFIRMED',
      scheduledAt: futureDate(2),
    });

    const res = await request(app)
      .patch(`/api/v1/clinic/doctors/${clinicDoctorId}/status?clinicId=${clinic.clinicId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'SUSPENDED' });
    expect(res.status).toBe(200);
    expect(res.body.data.cancelledAppointmentCount).toBe(0);

    const row = await prisma.appointment.findUniqueOrThrow({ where: { id: elsewhere.id } });
    expect(row.status).toBe('CONFIRMED');
  });

  it('a duplicate suspend call is a no-op the second time — idempotent, no double notification', async () => {
    const doctor = await createDoctorFixture(app);
    await request(app)
      .post('/api/v1/clinic/doctors')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, doctorId: doctor.doctorId, consultationTypes: ['IN_CLINIC'] });
    const clinicDoctorId = await getClinicDoctorId(admin.token, clinic.clinicId, doctor.doctorId);

    const appt = await createAppointmentFixture({
      patientId: patient.patientId,
      doctorId: doctor.doctorId,
      clinicId: clinic.clinicId,
      status: 'CONFIRMED',
      scheduledAt: futureDate(2),
    });

    const first = await request(app)
      .patch(`/api/v1/clinic/doctors/${clinicDoctorId}/status?clinicId=${clinic.clinicId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'SUSPENDED' });
    expect(first.body.data.cancelledAppointmentCount).toBe(1);

    const second = await request(app)
      .patch(`/api/v1/clinic/doctors/${clinicDoctorId}/status?clinicId=${clinic.clinicId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'SUSPENDED' });
    expect(second.status).toBe(200);
    expect(second.body.data.cancelledAppointmentCount).toBe(0);

    const notifCount = await prisma.notification.count({ where: { notificationKey: `appointment:${appt.id}:cancelled` } });
    expect(notifCount).toBe(1);
  });
});

describe('Deactivation cascade — removal', () => {
  it('removing the association cancels future appointments and the association is gone afterward', async () => {
    const doctor = await createDoctorFixture(app);
    await request(app)
      .post('/api/v1/clinic/doctors')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, doctorId: doctor.doctorId, consultationTypes: ['IN_CLINIC'] });
    const clinicDoctorId = await getClinicDoctorId(admin.token, clinic.clinicId, doctor.doctorId);

    const appt = await createAppointmentFixture({
      patientId: patient.patientId,
      doctorId: doctor.doctorId,
      clinicId: clinic.clinicId,
      status: 'CONFIRMED',
      scheduledAt: futureDate(2),
    });

    const res = await request(app).delete(`/api/v1/clinic/doctors/${clinicDoctorId}?clinicId=${clinic.clinicId}`).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.cancelledAppointmentCount).toBe(1);

    const row = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    expect(row.status).toBe('CANCELLED');
    expect(row.cancelReason).toBe('Doctor removed from this clinic');

    const afterRes = await request(app).get(`/api/v1/clinic/doctors?clinicId=${clinic.clinicId}`).set('Authorization', `Bearer ${admin.token}`);
    expect(afterRes.body.data.doctors.items.some((d: { doctorId: string }) => d.doctorId === doctor.doctorId)).toBe(false);
  });
});

describe('MANDATORY: concurrent deactivation requests never double-cancel or double-notify', () => {
  it('two concurrent suspend requests for the same clinicDoctorId cancel each conflicting appointment exactly once', async () => {
    const doctor = await createDoctorFixture(app);
    await request(app)
      .post('/api/v1/clinic/doctors')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, doctorId: doctor.doctorId, consultationTypes: ['IN_CLINIC'] });
    const clinicDoctorId = await getClinicDoctorId(admin.token, clinic.clinicId, doctor.doctorId);

    const appt = await createAppointmentFixture({
      patientId: patient.patientId,
      doctorId: doctor.doctorId,
      clinicId: clinic.clinicId,
      status: 'CONFIRMED',
      scheduledAt: futureDate(2),
    });

    const [resA, resB] = await Promise.all([
      request(app)
        .patch(`/api/v1/clinic/doctors/${clinicDoctorId}/status?clinicId=${clinic.clinicId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'SUSPENDED' }),
      request(app)
        .patch(`/api/v1/clinic/doctors/${clinicDoctorId}/status?clinicId=${clinic.clinicId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'SUSPENDED' }),
    ]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    const totalClaimed = resA.body.data.cancelledAppointmentCount + resB.body.data.cancelledAppointmentCount;
    expect(totalClaimed).toBe(1);

    const row = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    expect(row.status).toBe('CANCELLED');

    const notifCount = await prisma.notification.count({ where: { notificationKey: `appointment:${appt.id}:cancelled` } });
    expect(notifCount).toBe(1);

    const appointmentAudits = await prisma.auditLog.count({ where: { entityType: 'Appointment', entityId: appt.id, action: 'appointment.cancelled' } });
    expect(appointmentAudits).toBe(1);
  });
});
