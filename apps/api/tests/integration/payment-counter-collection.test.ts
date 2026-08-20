import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { CLINIC_PERMISSIONS } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

async function setupWalkIn() {
  const fixture = await createDoctorFixture(app); // consultationFee: 500
  const patient = await createPatientFixture(app);
  const appointment = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'CONFIRMED' });
  return { fixture, patient, appointment };
}

describe('POST /api/v1/payments/collect', () => {
  it('rejects an unauthenticated request', async () => {
    const { appointment } = await setupWalkIn();
    const res = await request(app).post('/api/v1/payments/collect').send({ appointmentId: appointment.id, method: 'CASH' });
    expect(res.status).toBe(401);
  });

  it('rejects a patient (only clinic staff can record a counter payment)', async () => {
    const { appointment, patient } = await setupWalkIn();
    const res = await request(app).post('/api/v1/payments/collect').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appointment.id, method: 'CASH' });
    expect(res.status).toBe(403);
  });

  it('rejects staff without PAYMENT_COLLECT', async () => {
    const { fixture, appointment } = await setupWalkIn();
    const staff = await createReceptionFixture(app, fixture.clinicId, []);
    const res = await request(app).post('/api/v1/payments/collect').set('Authorization', `Bearer ${staff.token}`).send({ appointmentId: appointment.id, method: 'CASH' });
    expect(res.status).toBe(403);
  });

  it('rejects staff at a different clinic (clinic isolation)', async () => {
    const { appointment } = await setupWalkIn();
    const otherClinic = await createDoctorFixture(app);
    const foreignStaff = await createReceptionFixture(app, otherClinic.clinicId, [CLINIC_PERMISSIONS.PAYMENT_COLLECT]);
    const res = await request(app).post('/api/v1/payments/collect').set('Authorization', `Bearer ${foreignStaff.token}`).send({ appointmentId: appointment.id, method: 'CASH' });
    expect(res.status).toBe(403);
  });

  it('rejects an invalid method', async () => {
    const { fixture, appointment } = await setupWalkIn();
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.PAYMENT_COLLECT]);
    const res = await request(app).post('/api/v1/payments/collect').set('Authorization', `Bearer ${staff.token}`).send({ appointmentId: appointment.id, method: 'NETBANKING' });
    expect(res.status).toBe(400);
  });

  it('records a cash payment, creates an invoice, notifies the patient, and audits both the generic and counter-specific actions', async () => {
    const { fixture, patient, appointment } = await setupWalkIn();
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.PAYMENT_COLLECT]);

    const res = await request(app)
      .post('/api/v1/payments/collect')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ appointmentId: appointment.id, method: 'CASH', notes: 'Paid at reception desk' });
    expect(res.status).toBe(201);
    expect(res.body.data.payment.status).toBe('CAPTURED');
    expect(res.body.data.payment.provider).toBe('OFFLINE');
    expect(res.body.data.payment.method).toBe('CASH');
    expect(res.body.data.payment.amount).toBe(500);
    expect(res.body.data.payment.invoiceNumber).not.toBeNull();

    const payment = await prisma.payment.findUniqueOrThrow({ where: { appointmentId: appointment.id } });
    expect(payment.status).toBe('CAPTURED');
    expect(payment.capturedAmount?.toString()).toBe('500');

    const capturedAudit = await prisma.auditLog.findFirst({ where: { entityType: 'Payment', entityId: payment.id, action: 'payment.captured' } });
    expect(capturedAudit).not.toBeNull();
    const counterAudit = await prisma.auditLog.findFirst({ where: { entityType: 'Payment', entityId: payment.id, action: 'payment.collected_at_counter' } });
    expect(counterAudit).not.toBeNull();
    expect(counterAudit!.actorUserId).toBe(staff.userId);

    const notif = await prisma.notification.findUnique({ where: { notificationKey: `payment:${payment.id}:captured` } });
    expect(notif).not.toBeNull();
    expect(notif!.userId).toBe(patient.userId);
  });

  it('rejects recording a payment for a cancelled appointment', async () => {
    const { fixture, appointment: cancelled } = await (async () => {
      const fixture = await createDoctorFixture(app);
      const patient = await createPatientFixture(app);
      const appointment = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'CANCELLED' });
      return { fixture, patient, appointment };
    })();
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.PAYMENT_COLLECT]);
    const res = await request(app).post('/api/v1/payments/collect').set('Authorization', `Bearer ${staff.token}`).send({ appointmentId: cancelled.id, method: 'CASH' });
    expect(res.status).toBe(409);
  });

  it('rejects recording a duplicate payment when one already exists for the appointment', async () => {
    const { fixture, appointment } = await setupWalkIn();
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.PAYMENT_COLLECT]);

    const first = await request(app).post('/api/v1/payments/collect').set('Authorization', `Bearer ${staff.token}`).send({ appointmentId: appointment.id, method: 'CASH' });
    expect(first.status).toBe(201);

    const second = await request(app).post('/api/v1/payments/collect').set('Authorization', `Bearer ${staff.token}`).send({ appointmentId: appointment.id, method: 'UPI' });
    expect(second.status).toBe(409);
  });

  it('returns 404 for a nonexistent appointment', async () => {
    const fixture = await createDoctorFixture(app);
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.PAYMENT_COLLECT]);
    const res = await request(app)
      .post('/api/v1/payments/collect')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ appointmentId: '00000000-0000-0000-0000-000000000000', method: 'CASH' });
    expect(res.status).toBe(404);
  });

  it('a counter payment can be refunded without any payment gateway involved', async () => {
    const { fixture, appointment } = await setupWalkIn();
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.PAYMENT_COLLECT, CLINIC_PERMISSIONS.PAYMENT_REFUND]);

    const collectRes = await request(app).post('/api/v1/payments/collect').set('Authorization', `Bearer ${staff.token}`).send({ appointmentId: appointment.id, method: 'CASH' });
    const paymentId = collectRes.body.data.payment.id as string;

    const refundRes = await request(app).post(`/api/v1/payments/${paymentId}/refund`).set('Authorization', `Bearer ${staff.token}`).send({ reason: 'Patient left before consultation' });
    expect(refundRes.status).toBe(200);
    expect(refundRes.body.data.payment.status).toBe('REFUNDED');

    const refund = await prisma.refund.findFirst({ where: { paymentId } });
    expect(refund!.providerRefundId).toMatch(/^counter-refund-/);
  });

  it('a recorded counter payment is included in the clinic billing summary', async () => {
    const { fixture, appointment } = await setupWalkIn();
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.PAYMENT_COLLECT, CLINIC_PERMISSIONS.BILLING_VIEW]);

    await request(app).post('/api/v1/payments/collect').set('Authorization', `Bearer ${staff.token}`).send({ appointmentId: appointment.id, method: 'CASH' });

    const billingRes = await request(app).get(`/api/v1/clinic/billing?clinicId=${fixture.clinicId}`).set('Authorization', `Bearer ${staff.token}`);
    expect(billingRes.status).toBe(200);
    expect(billingRes.body.data.items.items.some((row: { appointmentId: string }) => row.appointmentId === appointment.id)).toBe(true);
  });
});

describe('MANDATORY: two concurrent counter-payment collections for the same appointment', () => {
  it('exactly one succeeds; exactly one Payment row, one invoice, one notification exist', async () => {
    const { fixture, appointment } = await setupWalkIn();
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.PAYMENT_COLLECT]);

    const [a, b] = await Promise.all([
      request(app).post('/api/v1/payments/collect').set('Authorization', `Bearer ${staff.token}`).send({ appointmentId: appointment.id, method: 'CASH' }),
      request(app).post('/api/v1/payments/collect').set('Authorization', `Bearer ${staff.token}`).send({ appointmentId: appointment.id, method: 'UPI' }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);

    const payments = await prisma.payment.findMany({ where: { appointmentId: appointment.id } });
    expect(payments).toHaveLength(1);
    expect(payments[0]!.status).toBe('CAPTURED');

    const invoices = await prisma.invoice.count({ where: { appointmentId: appointment.id } });
    expect(invoices).toBe(1);

    const notifCount = await prisma.notification.count({ where: { notificationKey: `payment:${payments[0]!.id}:captured` } });
    expect(notifCount).toBe(1);
  });
});
