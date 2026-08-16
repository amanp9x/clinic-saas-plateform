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

async function simulate(token: string, paymentId: string) {
  const res = await request(app).post(`/api/v1/payments/${paymentId}/simulate`).set('Authorization', `Bearer ${token}`).send({ outcome: 'success' });
  expect(res.status).toBe(200);
  return res.body.data as { providerPaymentId: string; providerSignature: string; providerOrderId: string };
}

describe('Concurrency safety — payments', () => {
  it('two simultaneous verification requests for the same payment produce exactly one capture and exactly one invoice', async () => {
    const { patient, appointment } = await setupPendingPaidAppointment(app);
    const order = await createOrder(patient.token, appointment.id);
    const checkout = await simulate(patient.token, order.paymentId);
    const body = { paymentId: order.paymentId, providerOrderId: checkout.providerOrderId, providerPaymentId: checkout.providerPaymentId, providerSignature: checkout.providerSignature };

    const results = await Promise.all([
      request(app).post('/api/v1/payments/verify').set('Authorization', `Bearer ${patient.token}`).send(body),
      request(app).post('/api/v1/payments/verify').set('Authorization', `Bearer ${patient.token}`).send(body),
    ]);
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(results.every((r) => r.body.data.payment.status === 'CAPTURED')).toBe(true);

    const invoiceCount = await prisma.invoice.count({ where: { paymentId: order.paymentId } });
    expect(invoiceCount).toBe(1);

    const appt = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(appt.status).toBe('CONFIRMED');
  });

  it('the same webhook event delivered simultaneously is processed exactly once', async () => {
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

    const results = await Promise.all([
      request(app).post('/api/v1/payments/webhooks/mock').set('Content-Type', 'application/json').set('x-mock-signature', signature).send(body.toString('utf8')),
      request(app).post('/api/v1/payments/webhooks/mock').set('Content-Type', 'application/json').set('x-mock-signature', signature).send(body.toString('utf8')),
    ]);
    expect(results.every((r) => r.status === 200)).toBe(true);

    const invoiceCount = await prisma.invoice.count({ where: { paymentId: order.paymentId } });
    expect(invoiceCount).toBe(1);
    const eventCount = await prisma.paymentWebhookEvent.count({ where: { provider: 'MOCK', providerEventId: JSON.parse(body.toString('utf8')).id } });
    expect(eventCount).toBe(1);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: order.paymentId } });
    expect(payment.status).toBe('CAPTURED');
    const appt = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(appt.status).toBe('CONFIRMED');
  });

  it('two simultaneous refund requests never both succeed — exactly one refund is recorded', async () => {
    const { fixture, patient, appointment } = await setupPendingPaidAppointment(app);
    const order = await createOrder(patient.token, appointment.id);
    const checkout = await simulate(patient.token, order.paymentId);
    await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ paymentId: order.paymentId, providerOrderId: checkout.providerOrderId, providerPaymentId: checkout.providerPaymentId, providerSignature: checkout.providerSignature });

    const { CLINIC_PERMISSIONS } = await import('@clinic/shared');
    const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.PAYMENT_REFUND]);

    const results = await Promise.all([
      request(app).post(`/api/v1/payments/${order.paymentId}/refund`).set('Authorization', `Bearer ${staff.token}`).send({ reason: 'Race A' }),
      request(app).post(`/api/v1/payments/${order.paymentId}/refund`).set('Authorization', `Bearer ${staff.token}`).send({ reason: 'Race B' }),
    ]);

    const successes = results.filter((r) => r.status === 200);
    const conflicts = results.filter((r) => r.status === 409);
    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(1);

    const refundCount = await prisma.refund.count({ where: { paymentId: order.paymentId } });
    expect(refundCount).toBe(1);
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: order.paymentId } });
    expect(payment.status).toBe('REFUNDED');
    expect(payment.refundedAmount.toString()).toBe('500');
  });
});
