import { describe, expect, it } from 'vitest';
import request from 'supertest';

const { createApp } = await import('../../src/app.js');
const { setupPendingPaidAppointment } = await import('../helpers/payment-fixtures.js');
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

describe('Payment timeout', () => {
  it('a payment past its expiry is lazily cancelled on next read, releasing the appointment slot', async () => {
    const { fixture, patient, appointment } = await setupPendingPaidAppointment(app);
    const order = await createOrder(patient.token, appointment.id);

    // Deterministic substitute for waiting out the real window — same legitimate backdating
    // pattern the Phase 8 SlotHold expiry tests use.
    await prisma.payment.update({ where: { id: order.paymentId }, data: { expiresAt: new Date(Date.now() - 60_000) } });

    const statusRes = await request(app).get(`/api/v1/payments/${order.paymentId}/status`).set('Authorization', `Bearer ${patient.token}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.status).toBe('CANCELLED');

    const appt = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(appt.status).toBe('CANCELLED');
    expect(appt.cancelReason).toMatch(/payment window expired/i);

    // The slot is genuinely free again for a new booking attempt.
    const other = await (await import('../helpers/doctor-fixtures.js')).createPatientFixture(app);
    const rebook = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${other.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: appt.scheduledAt.toISOString(), consultationType: appt.consultationType, appointmentType: 'NEW_CONSULTATION' });
    expect(rebook.status).toBe(201);
  });

  it('an expired payment cannot be verified', async () => {
    const { patient, appointment } = await setupPendingPaidAppointment(app);
    const order = await createOrder(patient.token, appointment.id);
    const checkout = await simulate(patient.token, order.paymentId);
    await prisma.payment.update({ where: { id: order.paymentId }, data: { expiresAt: new Date(Date.now() - 60_000) } });

    const res = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ paymentId: order.paymentId, providerOrderId: checkout.providerOrderId, providerPaymentId: checkout.providerPaymentId, providerSignature: checkout.providerSignature });
    // The payment was reaped (CANCELLED) as part of ownership resolution inside verify — a
    // signature that was valid for the now-cancelled order is correctly no longer verifiable.
    expect(res.status).toBe(409);
  });
});

describe('Retry payment', () => {
  it('lets the patient retry after a failed verification, without creating a second appointment', async () => {
    const { patient, appointment } = await setupPendingPaidAppointment(app);
    const order = await createOrder(patient.token, appointment.id);
    const checkout = await simulate(patient.token, order.paymentId);

    const failedVerify = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ paymentId: order.paymentId, providerOrderId: checkout.providerOrderId, providerPaymentId: checkout.providerPaymentId, providerSignature: `${checkout.providerSignature}bad` });
    expect(failedVerify.status).toBe(400);

    const retryRes = await request(app).post(`/api/v1/payments/${order.paymentId}/retry`).set('Authorization', `Bearer ${patient.token}`);
    expect(retryRes.status).toBe(200);
    const retryOrder = retryRes.body.data.order as { paymentId: string; providerOrderId: string };
    expect(retryOrder.paymentId).toBe(order.paymentId); // same logical payment
    expect(retryOrder.providerOrderId).not.toBe(order.providerOrderId); // new attempt/order

    const attempts = await prisma.paymentAttempt.findMany({ where: { paymentId: order.paymentId }, orderBy: { attemptNumber: 'asc' } });
    expect(attempts).toHaveLength(2);
    expect(attempts[0]!.status).toBe('FAILED');
    expect(attempts[1]!.status).toBe('CREATED');

    const retryCheckout = await simulate(patient.token, order.paymentId);
    const verifyRes = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ paymentId: order.paymentId, providerOrderId: retryOrder.providerOrderId, providerPaymentId: retryCheckout.providerPaymentId, providerSignature: retryCheckout.providerSignature });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.payment.status).toBe('CAPTURED');

    // Exactly one appointment, one payment, one invoice for this whole retry sequence.
    const appointmentCount = await prisma.appointment.count({ where: { bookingReference: appointment.bookingReference } });
    expect(appointmentCount).toBe(1);
    const paymentCount = await prisma.payment.count({ where: { appointmentId: appointment.id } });
    expect(paymentCount).toBe(1);
    const invoiceCount = await prisma.invoice.count({ where: { paymentId: order.paymentId } });
    expect(invoiceCount).toBe(1);
  });

  it('rejects a retry on a payment that is not in FAILED status', async () => {
    const { patient, appointment } = await setupPendingPaidAppointment(app);
    const order = await createOrder(patient.token, appointment.id);
    const res = await request(app).post(`/api/v1/payments/${order.paymentId}/retry`).set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(409);
  });
});
