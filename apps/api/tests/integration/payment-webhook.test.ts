import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';

const { createApp } = await import('../../src/app.js');
const { setupPendingPaidAppointment } = await import('../helpers/payment-fixtures.js');
const { buildMockWebhookPayload } = await import('../../src/modules/payments/providers/mock-provider.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

async function createOrder(token: string, appointmentId: string) {
  const res = await request(app).post('/api/v1/payments/create-order').set('Authorization', `Bearer ${token}`).send({ appointmentId });
  expect(res.status).toBe(201);
  return res.body.data.order as { paymentId: string; providerOrderId: string; amount: number };
}

async function simulate(token: string, paymentId: string, outcome: 'success' | 'failure' = 'success') {
  const res = await request(app).post(`/api/v1/payments/${paymentId}/simulate`).set('Authorization', `Bearer ${token}`).send({ outcome });
  expect(res.status).toBe(200);
  return res.body.data as { providerPaymentId: string; providerSignature: string | null; providerOrderId: string };
}

describe('POST /api/v1/payments/webhooks/:provider', () => {
  it('rejects a request with a missing/invalid signature', async () => {
    const { patient, appointment } = await setupPendingPaidAppointment(app);
    const order = await createOrder(patient.token, appointment.id);
    const checkout = await simulate(patient.token, order.paymentId);
    const { body } = buildMockWebhookPayload({
      eventId: `evt_${randomUUID()}`,
      eventType: 'payment.captured',
      providerOrderId: checkout.providerOrderId,
      providerPaymentId: checkout.providerPaymentId,
      amount: order.amount,
      currency: 'INR',
    });

    const res = await request(app).post('/api/v1/payments/webhooks/mock').set('Content-Type', 'application/json').set('x-mock-signature', 'not-a-real-signature').send(body.toString('utf8'));
    expect(res.status).toBe(400);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: order.paymentId } });
    expect(payment.status).toBe('PENDING'); // untouched
  });

  it('rejects an unknown provider path', async () => {
    const res = await request(app).post('/api/v1/payments/webhooks/unknown-provider').set('Content-Type', 'application/json').send('{}');
    expect(res.status).toBe(400);
  });

  it('captures a payment via a valid payment.captured webhook and confirms the appointment', async () => {
    const { patient, appointment } = await setupPendingPaidAppointment(app);
    const order = await createOrder(patient.token, appointment.id);
    const checkout = await simulate(patient.token, order.paymentId);
    const { body, signature } = buildMockWebhookPayload({
      eventId: `evt_${randomUUID()}`,
      eventType: 'payment.captured',
      providerOrderId: checkout.providerOrderId,
      providerPaymentId: checkout.providerPaymentId,
      amount: order.amount,
      currency: 'INR',
    });

    const res = await request(app).post('/api/v1/payments/webhooks/mock').set('Content-Type', 'application/json').set('x-mock-signature', signature).send(body.toString('utf8'));
    expect(res.status).toBe(200);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: order.paymentId } });
    expect(payment.status).toBe('CAPTURED');
    const appt = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(appt.status).toBe('CONFIRMED');
    const invoice = await prisma.invoice.findUnique({ where: { paymentId: order.paymentId } });
    expect(invoice).not.toBeNull();
  });

  it('a duplicate delivery of the same event id is processed exactly once (sequential)', async () => {
    const { patient, appointment } = await setupPendingPaidAppointment(app);
    const order = await createOrder(patient.token, appointment.id);
    const checkout = await simulate(patient.token, order.paymentId);
    const { body, signature } = buildMockWebhookPayload({
      eventId: `evt_${randomUUID()}`,
      eventType: 'payment.captured',
      providerOrderId: checkout.providerOrderId,
      providerPaymentId: checkout.providerPaymentId,
      amount: order.amount,
      currency: 'INR',
    });

    const first = await request(app).post('/api/v1/payments/webhooks/mock').set('Content-Type', 'application/json').set('x-mock-signature', signature).send(body.toString('utf8'));
    const second = await request(app).post('/api/v1/payments/webhooks/mock').set('Content-Type', 'application/json').set('x-mock-signature', signature).send(body.toString('utf8'));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const invoiceCount = await prisma.invoice.count({ where: { paymentId: order.paymentId } });
    expect(invoiceCount).toBe(1);
  });

  it('marks a payment FAILED via a payment.failed webhook, leaving the appointment PENDING', async () => {
    const { patient, appointment } = await setupPendingPaidAppointment(app);
    const order = await createOrder(patient.token, appointment.id);
    const checkout = await simulate(patient.token, order.paymentId);
    const { body, signature } = buildMockWebhookPayload({
      eventId: `evt_${randomUUID()}`,
      eventType: 'payment.failed',
      providerOrderId: checkout.providerOrderId,
      providerPaymentId: checkout.providerPaymentId,
      amount: order.amount,
      currency: 'INR',
    });

    const res = await request(app).post('/api/v1/payments/webhooks/mock').set('Content-Type', 'application/json').set('x-mock-signature', signature).send(body.toString('utf8'));
    expect(res.status).toBe(200);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: order.paymentId } });
    expect(payment.status).toBe('FAILED');
    const appt = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(appt.status).toBe('PENDING');
  });

  it('an event for an unresolvable order is accepted (200) but has no effect', async () => {
    const { body, signature } = buildMockWebhookPayload({
      eventId: `evt_${randomUUID()}`,
      eventType: 'payment.captured',
      providerOrderId: 'mock_order_50000_INR_neverexisted',
      providerPaymentId: 'mock_pay_50000_INR_neverexisted',
      amount: 500,
      currency: 'INR',
    });
    const res = await request(app).post('/api/v1/payments/webhooks/mock').set('Content-Type', 'application/json').set('x-mock-signature', signature).send(body.toString('utf8'));
    expect(res.status).toBe(200);
  });
});
