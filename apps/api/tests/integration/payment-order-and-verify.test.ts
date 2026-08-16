import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { CLINIC_PERMISSIONS } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createPatientFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');
const { setupPendingPaidAppointment } = await import('../helpers/payment-fixtures.js');
const { signMockPayload } = await import('../../src/modules/payments/providers/mock-provider.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

async function createOrder(token: string, appointmentId: string) {
  const res = await request(app).post('/api/v1/payments/create-order').set('Authorization', `Bearer ${token}`).send({ appointmentId });
  expect(res.status).toBe(201);
  return res.body.data.order as { paymentId: string; providerOrderId: string; amount: number; currency: string; provider: string };
}

async function simulate(token: string, paymentId: string, outcome: 'success' | 'failure' = 'success') {
  const res = await request(app).post(`/api/v1/payments/${paymentId}/simulate`).set('Authorization', `Bearer ${token}`).send({ outcome });
  expect(res.status).toBe(200);
  return res.body.data as { providerPaymentId: string; providerSignature: string | null; providerOrderId: string };
}

describe('POST /api/v1/payments/create-order', () => {
  it('creates a server-priced order for a PENDING (payment-gated) appointment', async () => {
    const { patient, appointment } = await setupPendingPaidAppointment(app);
    expect(appointment.status).toBe('PENDING');

    const order = await createOrder(patient.token, appointment.id);
    expect(order.amount).toBe(500);
    expect(order.currency).toBe('INR');
    expect(order.provider).toBe('MOCK');
    expect(order.providerOrderId).toMatch(/^mock_order_/);
  });

  it('computes tax/service fee server-side — the client cannot influence the amount', async () => {
    const { patient, appointment } = await setupPendingPaidAppointment(app, { taxPercent: 10, serviceFeeFlat: 50 });
    // subtotal = 500 + 50 = 550; tax = 55; total = 605
    const order = await createOrder(patient.token, appointment.id);
    expect(order.amount).toBe(605);
  });

  it('rejects a patient who does not own the appointment', async () => {
    const { appointment } = await setupPendingPaidAppointment(app);
    const stranger = await createPatientFixture(app);
    const res = await request(app).post('/api/v1/payments/create-order').set('Authorization', `Bearer ${stranger.token}`).send({ appointmentId: appointment.id });
    expect(res.status).toBe(404);
  });

  it('rejects an appointment that does not require payment', async () => {
    const patient = await createPatientFixture(app);
    const res = await request(app).post('/api/v1/payments/create-order').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/payments/verify', () => {
  it('verifies a valid signature, captures the payment, confirms the appointment, and issues an invoice', async () => {
    const { patient, appointment } = await setupPendingPaidAppointment(app);
    const order = await createOrder(patient.token, appointment.id);
    const checkout = await simulate(patient.token, order.paymentId, 'success');

    const verifyRes = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ paymentId: order.paymentId, providerOrderId: checkout.providerOrderId, providerPaymentId: checkout.providerPaymentId, providerSignature: checkout.providerSignature });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.payment.status).toBe('CAPTURED');
    expect(verifyRes.body.data.payment.invoiceNumber).toMatch(/^INV-\d{4}-\d{6}$/);

    const appt = await request(app).get(`/api/v1/appointments/${appointment.id}`).set('Authorization', `Bearer ${patient.token}`);
    expect(appt.body.data.appointment.status).toBe('CONFIRMED');
    expect(appt.body.data.appointment.paymentStatus).toBe('CAPTURED');

    const invoice = await prisma.invoice.findUnique({ where: { paymentId: order.paymentId } });
    expect(invoice).not.toBeNull();
    expect(invoice!.total.toString()).toBe('500');
  });

  it('is idempotent — a duplicate verification call on an already-captured payment is a no-op, not an error', async () => {
    const { patient, appointment } = await setupPendingPaidAppointment(app);
    const order = await createOrder(patient.token, appointment.id);
    const checkout = await simulate(patient.token, order.paymentId, 'success');
    const body = { paymentId: order.paymentId, providerOrderId: checkout.providerOrderId, providerPaymentId: checkout.providerPaymentId, providerSignature: checkout.providerSignature };

    const first = await request(app).post('/api/v1/payments/verify').set('Authorization', `Bearer ${patient.token}`).send(body);
    const second = await request(app).post('/api/v1/payments/verify').set('Authorization', `Bearer ${patient.token}`).send(body);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.data.payment.status).toBe('CAPTURED');

    const invoiceCount = await prisma.invoice.count({ where: { paymentId: order.paymentId } });
    expect(invoiceCount).toBe(1);
  });

  it('rejects an invalid signature and leaves the appointment PENDING', async () => {
    const { patient, appointment } = await setupPendingPaidAppointment(app);
    const order = await createOrder(patient.token, appointment.id);
    const checkout = await simulate(patient.token, order.paymentId, 'success');

    const res = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ paymentId: order.paymentId, providerOrderId: checkout.providerOrderId, providerPaymentId: checkout.providerPaymentId, providerSignature: `${checkout.providerSignature}deadbeef` });
    expect(res.status).toBe(400);

    const payment = await prisma.payment.findUnique({ where: { id: order.paymentId } });
    expect(payment!.status).toBe('FAILED');
    const appt = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(appt.status).toBe('PENDING');
  });

  it('rejects an order id that does not belong to this payment', async () => {
    const { patient, appointment } = await setupPendingPaidAppointment(app);
    const order = await createOrder(patient.token, appointment.id);
    const checkout = await simulate(patient.token, order.paymentId, 'success');

    const res = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ paymentId: order.paymentId, providerOrderId: 'mock_order_50000_INR_bogus', providerPaymentId: checkout.providerPaymentId, providerSignature: checkout.providerSignature });
    expect(res.status).toBe(400);
  });

  it('rejects a validly-signed payment whose amount does not match the server-computed price', async () => {
    const { patient, appointment } = await setupPendingPaidAppointment(app);
    const order = await createOrder(patient.token, appointment.id);

    // A payment id that decodes to an amount ≠ the order's real amount, but validly signed for
    // this exact (orderId, paymentId) pair — simulates a compromised/tampered checkout response.
    const tamperedPaymentId = 'mock_pay_9999900_INR_tampered1';
    const tamperedSignature = signMockPayload(`${order.providerOrderId}|${tamperedPaymentId}`);

    const res = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ paymentId: order.paymentId, providerOrderId: order.providerOrderId, providerPaymentId: tamperedPaymentId, providerSignature: tamperedSignature });
    expect(res.status).toBe(400);

    const payment = await prisma.payment.findUnique({ where: { id: order.paymentId } });
    expect(payment!.status).toBe('FAILED');
    const appt = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(appt.status).toBe('PENDING'); // failed payment never confirms the appointment
  });

  it('rejects verification from a patient who does not own the payment', async () => {
    const { patient, appointment } = await setupPendingPaidAppointment(app);
    const order = await createOrder(patient.token, appointment.id);
    const checkout = await simulate(patient.token, order.paymentId, 'success');
    const stranger = await createPatientFixture(app);

    const res = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${stranger.token}`)
      .send({ paymentId: order.paymentId, providerOrderId: checkout.providerOrderId, providerPaymentId: checkout.providerPaymentId, providerSignature: checkout.providerSignature });
    expect(res.status).toBe(404);
  });
});

describe('Payment RBAC and clinic isolation', () => {
  it('lets the treating doctor view payment status but not a different doctor', async () => {
    const { fixture, patient, appointment } = await setupPendingPaidAppointment(app);
    const order = await createOrder(patient.token, appointment.id);

    const own = await request(app).get(`/api/v1/payments/${order.paymentId}`).set('Authorization', `Bearer ${fixture.token}`);
    expect(own.status).toBe(200);

    const { createDoctorFixture } = await import('../helpers/doctor-fixtures.js');
    const otherDoctor = await createDoctorFixture(app);
    const foreign = await request(app).get(`/api/v1/payments/${order.paymentId}`).set('Authorization', `Bearer ${otherDoctor.token}`);
    expect(foreign.status).toBe(404);
  });

  it('requires PAYMENT_VIEW for reception/clinic staff, and rejects staff from a different clinic', async () => {
    const { fixture, patient, appointment } = await setupPendingPaidAppointment(app);
    const order = await createOrder(patient.token, appointment.id);

    const noPerm = await createReceptionFixture(app, fixture.clinicId, []);
    const denied = await request(app).get(`/api/v1/payments/${order.paymentId}`).set('Authorization', `Bearer ${noPerm.token}`);
    expect(denied.status).toBe(403);

    const withPerm = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.PAYMENT_VIEW]);
    const allowed = await request(app).get(`/api/v1/payments/${order.paymentId}`).set('Authorization', `Bearer ${withPerm.token}`);
    expect(allowed.status).toBe(200);

    const { createDoctorFixture } = await import('../helpers/doctor-fixtures.js');
    const otherClinic = await createDoctorFixture(app);
    const foreignStaff = await createReceptionFixture(app, otherClinic.clinicId, [CLINIC_PERMISSIONS.PAYMENT_VIEW]);
    const isolated = await request(app).get(`/api/v1/payments/${order.paymentId}`).set('Authorization', `Bearer ${foreignStaff.token}`);
    expect(isolated.status).toBe(403);
  });
});
