import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { CLINIC_PERMISSIONS, UserRole } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { setupPendingPaidAppointment } = await import('../helpers/payment-fixtures.js');
const { createDoctorFixture, createPatientFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

async function payFor(patientToken: string, appointmentId: string) {
  const orderRes = await request(app).post('/api/v1/payments/create-order').set('Authorization', `Bearer ${patientToken}`).send({ appointmentId });
  const order = orderRes.body.data.order as { paymentId: string; providerOrderId: string };
  const simRes = await request(app).post(`/api/v1/payments/${order.paymentId}/simulate`).set('Authorization', `Bearer ${patientToken}`).send({ outcome: 'success' });
  const checkout = simRes.body.data as { providerPaymentId: string; providerSignature: string };
  const verifyRes = await request(app)
    .post('/api/v1/payments/verify')
    .set('Authorization', `Bearer ${patientToken}`)
    .send({ paymentId: order.paymentId, providerOrderId: order.providerOrderId, providerPaymentId: checkout.providerPaymentId, providerSignature: checkout.providerSignature });
  expect(verifyRes.status).toBe(200);
  return order.paymentId;
}

async function setupCapturedPayment() {
  const { fixture, patient, appointment } = await setupPendingPaidAppointment(app);
  const paymentId = await payFor(patient.token, appointment.id);
  return { fixture, patient, appointment, paymentId };
}

describe('POST /api/v1/payments/:id/refund-request — patient creates', () => {
  it('requires authentication', async () => {
    const res = await request(app).post(`/api/v1/payments/${randomUUID()}/refund-request`).send({ reason: 'Not needed anymore' });
    expect(res.status).toBe(401);
  });

  it('rejects a doctor/staff calling the patient-only endpoint', async () => {
    const { fixture, paymentId } = await setupCapturedPayment();
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.PAYMENT_REFUND]);
    const res = await request(app).post(`/api/v1/payments/${paymentId}/refund-request`).set('Authorization', `Bearer ${staff.token}`).send({ reason: 'Test' });
    expect(res.status).toBe(403);
  });

  it('404s (not 403) for another patient\'s payment — IDOR', async () => {
    const { paymentId } = await setupCapturedPayment();
    const otherPatient = await createPatientFixture(app);
    const res = await request(app).post(`/api/v1/payments/${paymentId}/refund-request`).set('Authorization', `Bearer ${otherPatient.token}`).send({ reason: 'Not mine' });
    expect(res.status).toBe(404);
  });

  it('404s for a nonexistent payment', async () => {
    const patient = await createPatientFixture(app);
    const res = await request(app).post(`/api/v1/payments/${randomUUID()}/refund-request`).set('Authorization', `Bearer ${patient.token}`).send({ reason: 'Test' });
    expect(res.status).toBe(404);
  });

  it('rejects a request for a payment that is not yet captured', async () => {
    const { patient, appointment } = await setupPendingPaidAppointment(app);
    const orderRes = await request(app).post('/api/v1/payments/create-order').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appointment.id });
    const paymentId = orderRes.body.data.order.paymentId as string;

    const res = await request(app).post(`/api/v1/payments/${paymentId}/refund-request`).set('Authorization', `Bearer ${patient.token}`).send({ reason: 'Test' });
    expect(res.status).toBe(409);
  });

  it('rejects an amount exceeding the refundable balance', async () => {
    const { patient, paymentId } = await setupCapturedPayment();
    const res = await request(app).post(`/api/v1/payments/${paymentId}/refund-request`).set('Authorization', `Bearer ${patient.token}`).send({ amount: 999999, reason: 'Too much' });
    expect(res.status).toBe(400);
  });

  it('rejects too short a reason', async () => {
    const { patient, paymentId } = await setupCapturedPayment();
    const res = await request(app).post(`/api/v1/payments/${paymentId}/refund-request`).set('Authorization', `Bearer ${patient.token}`).send({ reason: 'x' });
    expect(res.status).toBe(400);
  });

  it('creates a refund request, audits it, and notifies clinic admins', async () => {
    const { fixture, patient, paymentId } = await setupCapturedPayment();
    const clinicAdmin = await createReceptionFixture(app, fixture.clinicId, [], { role: UserRole.CLINIC_ADMIN });

    const res = await request(app).post(`/api/v1/payments/${paymentId}/refund-request`).set('Authorization', `Bearer ${patient.token}`).send({ reason: 'Could not attend' });
    expect(res.status).toBe(201);
    expect(res.body.data.refundRequest.status).toBe('REQUESTED');
    expect(res.body.data.refundRequest.paymentId).toBe(paymentId);
    expect(res.body.data.refundRequest.amount).toBeNull();
    expect(res.body.data.refundRequest.reason).toBe('Could not attend');

    const audit = await prisma.auditLog.findFirst({ where: { entityType: 'RefundRequest', entityId: res.body.data.refundRequest.id, action: 'patient.refund_requested' } });
    expect(audit).not.toBeNull();

    const notif = await prisma.notification.findUnique({
      where: { notificationKey: `refund-request:${res.body.data.refundRequest.id}:submitted:${clinicAdmin.userId}` },
    });
    expect(notif).not.toBeNull();
    expect(notif!.type).toBe('PAYMENT_REFUND_PENDING');
  });

  it('rejects a duplicate active request for the same payment', async () => {
    const { patient, paymentId } = await setupCapturedPayment();
    const first = await request(app).post(`/api/v1/payments/${paymentId}/refund-request`).set('Authorization', `Bearer ${patient.token}`).send({ reason: 'First request' });
    expect(first.status).toBe(201);

    const second = await request(app).post(`/api/v1/payments/${paymentId}/refund-request`).set('Authorization', `Bearer ${patient.token}`).send({ reason: 'Second request' });
    expect(second.status).toBe(409);
  });

  it('embeds the refund request in the payment detail response', async () => {
    const { patient, paymentId } = await setupCapturedPayment();
    await request(app).post(`/api/v1/payments/${paymentId}/refund-request`).set('Authorization', `Bearer ${patient.token}`).send({ reason: 'Please refund' });

    const res = await request(app).get(`/api/v1/payments/${paymentId}`).set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.payment.refundRequests).toHaveLength(1);
    expect(res.body.data.payment.refundRequests[0].status).toBe('REQUESTED');
  });
});

describe('GET /api/v1/payments/refund-requests — staff list', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/payments/refund-requests').query({ clinicId: randomUUID() });
    expect(res.status).toBe(401);
  });

  it('rejects a patient', async () => {
    const { patient, fixture } = await setupCapturedPayment();
    const res = await request(app).get('/api/v1/payments/refund-requests').query({ clinicId: fixture.clinicId }).set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(403);
  });

  it('rejects staff without PAYMENT_REFUND permission', async () => {
    const { fixture } = await setupCapturedPayment();
    const noPerm = await createReceptionFixture(app, fixture.clinicId, []);
    const res = await request(app).get('/api/v1/payments/refund-requests').query({ clinicId: fixture.clinicId }).set('Authorization', `Bearer ${noPerm.token}`);
    expect(res.status).toBe(403);
  });

  it('rejects staff from a different clinic — cross-clinic isolation', async () => {
    const { fixture } = await setupCapturedPayment();
    const otherClinic = await createDoctorFixture(app);
    const foreignStaff = await createReceptionFixture(app, otherClinic.clinicId, [CLINIC_PERMISSIONS.PAYMENT_REFUND]);
    const res = await request(app).get('/api/v1/payments/refund-requests').query({ clinicId: fixture.clinicId }).set('Authorization', `Bearer ${foreignStaff.token}`);
    expect(res.status).toBe(403);
  });

  it('lists refund requests for the authorized staff\'s clinic', async () => {
    const { fixture, patient, paymentId } = await setupCapturedPayment();
    await request(app).post(`/api/v1/payments/${paymentId}/refund-request`).set('Authorization', `Bearer ${patient.token}`).send({ reason: 'Please refund' });

    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.PAYMENT_REFUND]);
    const res = await request(app).get('/api/v1/payments/refund-requests').query({ clinicId: fixture.clinicId, status: 'REQUESTED' }).set('Authorization', `Bearer ${staff.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.some((r: { paymentId: string }) => r.paymentId === paymentId)).toBe(true);
  });
});

describe('PATCH /api/v1/payments/refund-requests/:id/approve — approval invokes the real refund engine', () => {
  it('rejects an unauthorized approver', async () => {
    const { fixture, patient, paymentId } = await setupCapturedPayment();
    const created = await request(app).post(`/api/v1/payments/${paymentId}/refund-request`).set('Authorization', `Bearer ${patient.token}`).send({ reason: 'Please refund' });
    const id = created.body.data.refundRequest.id;

    const noPerm = await createReceptionFixture(app, fixture.clinicId, []);
    const res = await request(app).patch(`/api/v1/payments/refund-requests/${id}/approve`).set('Authorization', `Bearer ${noPerm.token}`).send({});
    expect(res.status).toBe(403);
  });

  it('approves a request, actually refunds the payment, syncs the invoice, notifies the patient, and audits both layers', async () => {
    const { fixture, patient, paymentId } = await setupCapturedPayment();
    const created = await request(app).post(`/api/v1/payments/${paymentId}/refund-request`).set('Authorization', `Bearer ${patient.token}`).send({ reason: 'Please refund' });
    const id = created.body.data.refundRequest.id;
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.PAYMENT_REFUND]);

    const res = await request(app).patch(`/api/v1/payments/refund-requests/${id}/approve`).set('Authorization', `Bearer ${staff.token}`).send({});
    expect(res.status).toBe(200);
    expect(res.body.data.refundRequest.status).toBe('APPROVED');

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe('REFUNDED');
    expect(Number(payment.refundedAmount)).toBe(500);

    const invoice = await prisma.invoice.findUniqueOrThrow({ where: { paymentId } });
    expect(invoice.status).toBe('REFUNDED');

    const refundRows = await prisma.refund.findMany({ where: { paymentId } });
    expect(refundRows).toHaveLength(1);
    expect(refundRows[0]!.status).toBe('REFUNDED');

    const patientNotif = await prisma.notification.findUnique({ where: { notificationKey: `refund:${refundRows[0]!.id}:completed` } });
    expect(patientNotif).not.toBeNull();
    expect(patientNotif!.userId).toBe(patient.userId);

    const requestAudit = await prisma.auditLog.findFirst({ where: { entityType: 'RefundRequest', entityId: id, action: 'clinic.refund_request_approved' } });
    expect(requestAudit).not.toBeNull();
    const paymentAudit = await prisma.auditLog.findFirst({ where: { entityType: 'Payment', entityId: paymentId, action: 'payment.refunded' } });
    expect(paymentAudit).not.toBeNull();
  });

  it('rejects approving a request that is not in REQUESTED status', async () => {
    const { fixture, patient, paymentId } = await setupCapturedPayment();
    const created = await request(app).post(`/api/v1/payments/${paymentId}/refund-request`).set('Authorization', `Bearer ${patient.token}`).send({ reason: 'Please refund' });
    const id = created.body.data.refundRequest.id;
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.PAYMENT_REFUND]);

    const first = await request(app).patch(`/api/v1/payments/refund-requests/${id}/approve`).set('Authorization', `Bearer ${staff.token}`).send({});
    expect(first.status).toBe(200);

    const second = await request(app).patch(`/api/v1/payments/refund-requests/${id}/approve`).set('Authorization', `Bearer ${staff.token}`).send({});
    expect(second.status).toBe(409);
  });
});

describe('PATCH /api/v1/payments/refund-requests/:id/reject', () => {
  it('requires a reason', async () => {
    const { fixture, patient, paymentId } = await setupCapturedPayment();
    const created = await request(app).post(`/api/v1/payments/${paymentId}/refund-request`).set('Authorization', `Bearer ${patient.token}`).send({ reason: 'Please refund' });
    const id = created.body.data.refundRequest.id;
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.PAYMENT_REFUND]);

    const res = await request(app).patch(`/api/v1/payments/refund-requests/${id}/reject`).set('Authorization', `Bearer ${staff.token}`).send({});
    expect(res.status).toBe(400);
  });

  it('rejects the request, notifies the patient with the reason, and leaves the payment untouched', async () => {
    const { fixture, patient, paymentId } = await setupCapturedPayment();
    const created = await request(app).post(`/api/v1/payments/${paymentId}/refund-request`).set('Authorization', `Bearer ${patient.token}`).send({ reason: 'Please refund' });
    const id = created.body.data.refundRequest.id;
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.PAYMENT_REFUND]);

    const res = await request(app)
      .patch(`/api/v1/payments/refund-requests/${id}/reject`)
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ reviewNotes: 'Cancellation policy does not allow this' });
    expect(res.status).toBe(200);
    expect(res.body.data.refundRequest.status).toBe('REJECTED');

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe('CAPTURED');

    const notif = await prisma.notification.findUnique({ where: { notificationKey: `refund-request:${id}:rejected` } });
    expect(notif).not.toBeNull();
    expect(notif!.userId).toBe(patient.userId);
    expect(notif!.message).toContain('Cancellation policy does not allow this');

    const audit = await prisma.auditLog.findFirst({ where: { entityType: 'RefundRequest', entityId: id, action: 'clinic.refund_request_rejected' } });
    expect(audit).not.toBeNull();
  });

  it('rejects deciding a request twice', async () => {
    const { fixture, patient, paymentId } = await setupCapturedPayment();
    const created = await request(app).post(`/api/v1/payments/${paymentId}/refund-request`).set('Authorization', `Bearer ${patient.token}`).send({ reason: 'Please refund' });
    const id = created.body.data.refundRequest.id;
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.PAYMENT_REFUND]);

    const first = await request(app).patch(`/api/v1/payments/refund-requests/${id}/reject`).set('Authorization', `Bearer ${staff.token}`).send({ reviewNotes: 'Not eligible' });
    expect(first.status).toBe(200);

    const second = await request(app).patch(`/api/v1/payments/refund-requests/${id}/approve`).set('Authorization', `Bearer ${staff.token}`).send({});
    expect(second.status).toBe(409);
  });
});

describe(
  'MANDATORY: concurrent refund-request decisions never double-refund or corrupt state',
  () => {
    it('two concurrent approve requests: exactly one wins, exactly one refund is executed', async () => {
      const { fixture, patient, paymentId } = await setupCapturedPayment();
      const created = await request(app).post(`/api/v1/payments/${paymentId}/refund-request`).set('Authorization', `Bearer ${patient.token}`).send({ reason: 'Please refund' });
      const id = created.body.data.refundRequest.id;
      const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.PAYMENT_REFUND]);

      const [resA, resB] = await Promise.all([
        request(app).patch(`/api/v1/payments/refund-requests/${id}/approve`).set('Authorization', `Bearer ${staff.token}`).send({}),
        request(app).patch(`/api/v1/payments/refund-requests/${id}/approve`).set('Authorization', `Bearer ${staff.token}`).send({}),
      ]);

      const statuses = [resA.status, resB.status].sort();
      expect(statuses).toEqual([200, 409]);

      const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
      expect(payment.status).toBe('REFUNDED');
      expect(Number(payment.refundedAmount)).toBe(500);

      const refundRows = await prisma.refund.findMany({ where: { paymentId } });
      expect(refundRows).toHaveLength(1);

      const finalRequest = await prisma.refundRequest.findUniqueOrThrow({ where: { id } });
      expect(finalRequest.status).toBe('APPROVED');
    }, 20000);

    it('approve vs reject racing the same request: exactly one terminal decision wins, no duplicate refund', async () => {
      const { fixture, patient, paymentId } = await setupCapturedPayment();
      const created = await request(app).post(`/api/v1/payments/${paymentId}/refund-request`).set('Authorization', `Bearer ${patient.token}`).send({ reason: 'Please refund' });
      const id = created.body.data.refundRequest.id;
      const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.PAYMENT_REFUND]);

      const [approveRes, rejectRes] = await Promise.all([
        request(app).patch(`/api/v1/payments/refund-requests/${id}/approve`).set('Authorization', `Bearer ${staff.token}`).send({}),
        request(app).patch(`/api/v1/payments/refund-requests/${id}/reject`).set('Authorization', `Bearer ${staff.token}`).send({ reviewNotes: 'Racing reject' }),
      ]);

      const statuses = [approveRes.status, rejectRes.status].sort();
      expect(statuses).toEqual([200, 409]);

      const finalRequest = await prisma.refundRequest.findUniqueOrThrow({ where: { id } });
      expect(['APPROVED', 'REJECTED']).toContain(finalRequest.status);

      const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
      const refundRows = await prisma.refund.findMany({ where: { paymentId } });

      if (finalRequest.status === 'APPROVED') {
        expect(payment.status).toBe('REFUNDED');
        expect(refundRows).toHaveLength(1);
      } else {
        expect(payment.status).toBe('CAPTURED');
        expect(refundRows).toHaveLength(0);
      }
    }, 20000);

    it('two concurrent refund-request submissions for the same payment: at most one REQUESTED request exists', async () => {
      const { patient, paymentId } = await setupCapturedPayment();

      const [resA, resB] = await Promise.all([
        request(app).post(`/api/v1/payments/${paymentId}/refund-request`).set('Authorization', `Bearer ${patient.token}`).send({ reason: 'First attempt' }),
        request(app).post(`/api/v1/payments/${paymentId}/refund-request`).set('Authorization', `Bearer ${patient.token}`).send({ reason: 'Second attempt' }),
      ]);

      const statuses = [resA.status, resB.status].sort();
      expect(statuses).toEqual([201, 409]);

      const activeCount = await prisma.refundRequest.count({ where: { paymentId, status: 'REQUESTED' } });
      expect(activeCount).toBe(1);
    }, 20000);
  },
);
