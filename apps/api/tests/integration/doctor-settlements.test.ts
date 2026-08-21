import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createPlatformAdminFixture } = await import('../helpers/doctor-fixtures.js');
const { prisma } = await import('../../src/config/database.js');
const { generateBookingReference } = await import('../../src/modules/booking/booking-reference.util.js');

const app = createApp();

async function createCompletedAppointment(input: { doctorId: string; clinicId: string; patientId: string; consultationFee: number }) {
  const scheduledAt = new Date();
  return prisma.appointment.create({
    data: {
      doctorId: input.doctorId,
      clinicId: input.clinicId,
      patientId: input.patientId,
      status: 'COMPLETED',
      scheduledAt,
      completedAt: new Date(),
      consultationFee: input.consultationFee,
      bookingReference: generateBookingReference(scheduledAt),
    },
  });
}

let doctor: Awaited<ReturnType<typeof createDoctorFixture>>;
let otherDoctor: Awaited<ReturnType<typeof createDoctorFixture>>;
let patient: Awaited<ReturnType<typeof createPatientFixture>>;
let platformAdmin: Awaited<ReturnType<typeof createPlatformAdminFixture>>;

beforeAll(async () => {
  doctor = await createDoctorFixture(app);
  otherDoctor = await createDoctorFixture(app);
  patient = await createPatientFixture(app);
  platformAdmin = await createPlatformAdminFixture(app);
});

describe('Doctor settlement requests — doctor creates', () => {
  it('requires authentication', async () => {
    const res = await request(app).post('/api/v1/doctor/settlements').send({});
    expect(res.status).toBe(401);
  });

  it('rejects a patient calling the doctor-only endpoint', async () => {
    const res = await request(app).post('/api/v1/doctor/settlements').set('Authorization', `Bearer ${patient.token}`).send({});
    expect(res.status).toBe(403);
  });

  it('rejects a request when there are no unsettled earnings', async () => {
    const freshDoctor = await createDoctorFixture(app);
    const res = await request(app).post('/api/v1/doctor/settlements').set('Authorization', `Bearer ${freshDoctor.token}`).send({});
    expect(res.status).toBe(400);
  });

  it('creates a settlement request for a doctor with unsettled earnings, computed net of platform commission', async () => {
    const fresh = await createDoctorFixture(app);
    await createCompletedAppointment({ doctorId: fresh.doctorId, clinicId: fresh.clinicId, patientId: patient.patientId, consultationFee: 1000 });

    const res = await request(app).post('/api/v1/doctor/settlements').set('Authorization', `Bearer ${fresh.token}`).send({ notes: 'Please process' });
    expect(res.status).toBe(201);
    expect(res.body.data.settlement.status).toBe('REQUESTED');
    expect(res.body.data.settlement.amount).toBe('900');
    expect(res.body.data.settlement.doctorNotes).toBe('Please process');

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'SettlementRequest', entityId: res.body.data.settlement.id, action: 'doctor.settlement_requested' },
    });
    expect(audit).not.toBeNull();
  });

  it('rejects a duplicate active request for the same doctor', async () => {
    const fresh = await createDoctorFixture(app);
    await createCompletedAppointment({ doctorId: fresh.doctorId, clinicId: fresh.clinicId, patientId: patient.patientId, consultationFee: 1000 });

    const first = await request(app).post('/api/v1/doctor/settlements').set('Authorization', `Bearer ${fresh.token}`).send({});
    expect(first.status).toBe(201);

    const second = await request(app).post('/api/v1/doctor/settlements').set('Authorization', `Bearer ${fresh.token}`).send({});
    expect(second.status).toBe(409);
  });

  it('lists only the requesting doctor\'s own settlement requests', async () => {
    const fresh = await createDoctorFixture(app);
    const freshOther = await createDoctorFixture(app);
    await createCompletedAppointment({ doctorId: fresh.doctorId, clinicId: fresh.clinicId, patientId: patient.patientId, consultationFee: 500 });
    await createCompletedAppointment({ doctorId: freshOther.doctorId, clinicId: freshOther.clinicId, patientId: patient.patientId, consultationFee: 500 });
    await request(app).post('/api/v1/doctor/settlements').set('Authorization', `Bearer ${fresh.token}`).send({});
    await request(app).post('/api/v1/doctor/settlements').set('Authorization', `Bearer ${freshOther.token}`).send({});

    const res = await request(app).get('/api/v1/doctor/settlements').set('Authorization', `Bearer ${fresh.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
    expect(res.body.data.items.every((s: { doctorId: string }) => s.doctorId === fresh.doctorId)).toBe(true);
  });
});

describe('Platform-admin settlement review', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/platform-admin/settlements');
    expect(res.status).toBe(401);
  });

  it('rejects a doctor calling the platform-admin-only endpoint', async () => {
    const res = await request(app).get('/api/v1/platform-admin/settlements').set('Authorization', `Bearer ${doctor.token}`);
    expect(res.status).toBe(403);
  });

  it('404s for a nonexistent settlement request', async () => {
    const res = await request(app).get(`/api/v1/platform-admin/settlements/${randomUUID()}`).set('Authorization', `Bearer ${platformAdmin.token}`);
    expect(res.status).toBe(404);
  });

  it('requires a reason when rejecting', async () => {
    const fresh = await createDoctorFixture(app);
    await createCompletedAppointment({ doctorId: fresh.doctorId, clinicId: fresh.clinicId, patientId: patient.patientId, consultationFee: 500 });
    const created = await request(app).post('/api/v1/doctor/settlements').set('Authorization', `Bearer ${fresh.token}`).send({});
    const id = created.body.data.settlement.id;

    const res = await request(app).patch(`/api/v1/platform-admin/settlements/${id}/reject`).set('Authorization', `Bearer ${platformAdmin.token}`).send({});
    expect(res.status).toBe(400);
  });

  it('approves a request and notifies the doctor exactly once', async () => {
    const fresh = await createDoctorFixture(app);
    await createCompletedAppointment({ doctorId: fresh.doctorId, clinicId: fresh.clinicId, patientId: patient.patientId, consultationFee: 500 });
    const created = await request(app).post('/api/v1/doctor/settlements').set('Authorization', `Bearer ${fresh.token}`).send({});
    const id = created.body.data.settlement.id;

    const res = await request(app).patch(`/api/v1/platform-admin/settlements/${id}/approve`).set('Authorization', `Bearer ${platformAdmin.token}`).send({});
    expect(res.status).toBe(200);
    expect(res.body.data.settlement.status).toBe('APPROVED');

    const notif = await prisma.notification.findUnique({ where: { notificationKey: `settlement:${id}:APPROVED` } });
    expect(notif).not.toBeNull();
    expect(notif!.type).toBe('SETTLEMENT_STATUS_UPDATED');
    expect(notif!.userId).toBe(fresh.userId);

    const audit = await prisma.auditLog.findFirst({ where: { entityType: 'SettlementRequest', entityId: id, action: 'platform.settlement_approved' } });
    expect(audit).not.toBeNull();
  });

  it('rejects a request with a reason and notifies the doctor', async () => {
    const fresh = await createDoctorFixture(app);
    await createCompletedAppointment({ doctorId: fresh.doctorId, clinicId: fresh.clinicId, patientId: patient.patientId, consultationFee: 500 });
    const created = await request(app).post('/api/v1/doctor/settlements').set('Authorization', `Bearer ${fresh.token}`).send({});
    const id = created.body.data.settlement.id;

    const res = await request(app)
      .patch(`/api/v1/platform-admin/settlements/${id}/reject`)
      .set('Authorization', `Bearer ${platformAdmin.token}`)
      .send({ reviewNotes: 'Amount does not match our records' });
    expect(res.status).toBe(200);
    expect(res.body.data.settlement.status).toBe('REJECTED');
    expect(res.body.data.settlement.reviewNotes).toBe('Amount does not match our records');

    const notif = await prisma.notification.findUnique({ where: { notificationKey: `settlement:${id}:REJECTED` } });
    expect(notif).not.toBeNull();
  });

  it('cannot mark a REQUESTED request as paid — must be APPROVED first', async () => {
    const fresh = await createDoctorFixture(app);
    await createCompletedAppointment({ doctorId: fresh.doctorId, clinicId: fresh.clinicId, patientId: patient.patientId, consultationFee: 500 });
    const created = await request(app).post('/api/v1/doctor/settlements').set('Authorization', `Bearer ${fresh.token}`).send({});
    const id = created.body.data.settlement.id;

    const res = await request(app).patch(`/api/v1/platform-admin/settlements/${id}/mark-paid`).set('Authorization', `Bearer ${platformAdmin.token}`).send({});
    expect(res.status).toBe(409);
  });

  it('full lifecycle: REQUESTED -> APPROVED -> PAID', async () => {
    const fresh = await createDoctorFixture(app);
    await createCompletedAppointment({ doctorId: fresh.doctorId, clinicId: fresh.clinicId, patientId: patient.patientId, consultationFee: 500 });
    const created = await request(app).post('/api/v1/doctor/settlements').set('Authorization', `Bearer ${fresh.token}`).send({});
    const id = created.body.data.settlement.id;

    const approved = await request(app).patch(`/api/v1/platform-admin/settlements/${id}/approve`).set('Authorization', `Bearer ${platformAdmin.token}`).send({});
    expect(approved.status).toBe(200);

    const paid = await request(app).patch(`/api/v1/platform-admin/settlements/${id}/mark-paid`).set('Authorization', `Bearer ${platformAdmin.token}`).send({});
    expect(paid.status).toBe(200);
    expect(paid.body.data.settlement.status).toBe('PAID');
    expect(paid.body.data.settlement.paidAt).not.toBeNull();

    const notif = await prisma.notification.findUnique({ where: { notificationKey: `settlement:${id}:PAID` } });
    expect(notif).not.toBeNull();
  });

  it('rejects any further transition once a request reaches the terminal PAID state', async () => {
    const fresh = await createDoctorFixture(app);
    await createCompletedAppointment({ doctorId: fresh.doctorId, clinicId: fresh.clinicId, patientId: patient.patientId, consultationFee: 500 });
    const created = await request(app).post('/api/v1/doctor/settlements').set('Authorization', `Bearer ${fresh.token}`).send({});
    const id = created.body.data.settlement.id;

    const approved = await request(app).patch(`/api/v1/platform-admin/settlements/${id}/approve`).set('Authorization', `Bearer ${platformAdmin.token}`).send({});
    expect(approved.status).toBe(200);

    const paid = await request(app).patch(`/api/v1/platform-admin/settlements/${id}/mark-paid`).set('Authorization', `Bearer ${platformAdmin.token}`).send({});
    expect(paid.status).toBe(200);

    const rejectAfterPaid = await request(app)
      .patch(`/api/v1/platform-admin/settlements/${id}/reject`)
      .set('Authorization', `Bearer ${platformAdmin.token}`)
      .send({ reviewNotes: 'Too late' });
    expect(rejectAfterPaid.status).toBe(409);
  });

  it('rejects a double-approve of the same REQUESTED request', async () => {
    const fresh = await createDoctorFixture(app);
    await createCompletedAppointment({ doctorId: fresh.doctorId, clinicId: fresh.clinicId, patientId: patient.patientId, consultationFee: 500 });
    const created = await request(app).post('/api/v1/doctor/settlements').set('Authorization', `Bearer ${fresh.token}`).send({});
    const id = created.body.data.settlement.id;

    const first = await request(app).patch(`/api/v1/platform-admin/settlements/${id}/approve`).set('Authorization', `Bearer ${platformAdmin.token}`).send({});
    expect(first.status).toBe(200);

    const second = await request(app).patch(`/api/v1/platform-admin/settlements/${id}/approve`).set('Authorization', `Bearer ${platformAdmin.token}`).send({});
    expect(second.status).toBe(409);
  });

  it('allows a new request once the previous one was rejected — the active-only unique constraint does not block it', async () => {
    const fresh = await createDoctorFixture(app);
    await createCompletedAppointment({ doctorId: fresh.doctorId, clinicId: fresh.clinicId, patientId: patient.patientId, consultationFee: 500 });
    const first = await request(app).post('/api/v1/doctor/settlements').set('Authorization', `Bearer ${fresh.token}`).send({});
    const firstId = first.body.data.settlement.id;

    await request(app)
      .patch(`/api/v1/platform-admin/settlements/${firstId}/reject`)
      .set('Authorization', `Bearer ${platformAdmin.token}`)
      .send({ reviewNotes: 'Rejected for now' });

    await createCompletedAppointment({ doctorId: fresh.doctorId, clinicId: fresh.clinicId, patientId: patient.patientId, consultationFee: 500 });
    const second = await request(app).post('/api/v1/doctor/settlements').set('Authorization', `Bearer ${fresh.token}`).send({});
    expect(second.status).toBe(201);
  });
});

describe('MANDATORY: concurrent admin actions on the same settlement request never corrupt state', () => {
  it('one approve and one reject racing the same REQUESTED request: exactly one wins, no double notification', async () => {
    const fresh = await createDoctorFixture(app);
    await createCompletedAppointment({ doctorId: fresh.doctorId, clinicId: fresh.clinicId, patientId: patient.patientId, consultationFee: 500 });
    const created = await request(app).post('/api/v1/doctor/settlements').set('Authorization', `Bearer ${fresh.token}`).send({});
    const id = created.body.data.settlement.id;

    const [approveRes, rejectRes] = await Promise.all([
      request(app).patch(`/api/v1/platform-admin/settlements/${id}/approve`).set('Authorization', `Bearer ${platformAdmin.token}`).send({}),
      request(app)
        .patch(`/api/v1/platform-admin/settlements/${id}/reject`)
        .set('Authorization', `Bearer ${platformAdmin.token}`)
        .send({ reviewNotes: 'Racing reject' }),
    ]);

    const statuses = [approveRes.status, rejectRes.status].sort();
    expect(statuses).toEqual([200, 409]);

    const final = await prisma.settlementRequest.findUniqueOrThrow({ where: { id } });
    expect(['APPROVED', 'REJECTED']).toContain(final.status);

    const notifCount = await prisma.notification.count({ where: { relatedEntityType: 'SettlementRequest', relatedEntityId: id } });
    expect(notifCount).toBe(1);

    if (final.status === 'APPROVED') {
      const rejectNotif = await prisma.notification.findUnique({ where: { notificationKey: `settlement:${id}:REJECTED` } });
      expect(rejectNotif).toBeNull();
    } else {
      const approveNotif = await prisma.notification.findUnique({ where: { notificationKey: `settlement:${id}:APPROVED` } });
      expect(approveNotif).toBeNull();
    }
  });

  it('two concurrent approve responses to the same REQUESTED request produce exactly one success and one notification', async () => {
    const fresh = await createDoctorFixture(app);
    await createCompletedAppointment({ doctorId: fresh.doctorId, clinicId: fresh.clinicId, patientId: patient.patientId, consultationFee: 500 });
    const created = await request(app).post('/api/v1/doctor/settlements').set('Authorization', `Bearer ${fresh.token}`).send({});
    const id = created.body.data.settlement.id;

    const [resA, resB] = await Promise.all([
      request(app).patch(`/api/v1/platform-admin/settlements/${id}/approve`).set('Authorization', `Bearer ${platformAdmin.token}`).send({}),
      request(app).patch(`/api/v1/platform-admin/settlements/${id}/approve`).set('Authorization', `Bearer ${platformAdmin.token}`).send({}),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);

    const notifCount = await prisma.notification.count({ where: { notificationKey: `settlement:${id}:APPROVED` } });
    expect(notifCount).toBe(1);
  });
});
