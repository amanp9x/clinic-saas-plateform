import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { CLINIC_PERMISSIONS } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { setupPendingPaidAppointment } = await import('../helpers/payment-fixtures.js');
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

describe('POST /api/v1/payments/:id/refund', () => {
  it('rejects a refund from a patient (only clinic staff can refund) and from staff without PAYMENT_REFUND', async () => {
    const { fixture, patient, appointment } = await setupPendingPaidAppointment(app);
    const paymentId = await payFor(patient.token, appointment.id);

    const asPatient = await request(app).post(`/api/v1/payments/${paymentId}/refund`).set('Authorization', `Bearer ${patient.token}`).send({ reason: 'Changed my mind' });
    expect(asPatient.status).toBe(403);

    const noPerm = await createReceptionFixture(app, fixture.clinicId, []);
    const asUnauthorizedStaff = await request(app).post(`/api/v1/payments/${paymentId}/refund`).set('Authorization', `Bearer ${noPerm.token}`).send({ reason: 'Patient request' });
    expect(asUnauthorizedStaff.status).toBe(403);
  });

  it('rejects a refund from staff at a different clinic (clinic isolation)', async () => {
    const { patient, appointment } = await setupPendingPaidAppointment(app);
    const paymentId = await payFor(patient.token, appointment.id);

    const { createDoctorFixture } = await import('../helpers/doctor-fixtures.js');
    const otherClinic = await createDoctorFixture(app);
    const foreignStaff = await createReceptionFixture(app, otherClinic.clinicId, [CLINIC_PERMISSIONS.PAYMENT_REFUND]);
    const res = await request(app).post(`/api/v1/payments/${paymentId}/refund`).set('Authorization', `Bearer ${foreignStaff.token}`).send({ reason: 'Patient request' });
    expect(res.status).toBe(403);
  });

  it('fully refunds a captured payment by default (100% eligibility)', async () => {
    const { fixture, patient, appointment } = await setupPendingPaidAppointment(app);
    const paymentId = await payFor(patient.token, appointment.id);
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.PAYMENT_REFUND]);

    const res = await request(app).post(`/api/v1/payments/${paymentId}/refund`).set('Authorization', `Bearer ${staff.token}`).send({ reason: 'Patient could not attend' });
    expect(res.status).toBe(200);
    expect(res.body.data.payment.status).toBe('REFUNDED');
    expect(res.body.data.payment.refundedAmount).toBe(500);
    expect(res.body.data.payment.refunds).toHaveLength(1);
    expect(res.body.data.payment.refunds[0].status).toBe('REFUNDED');
  });

  it('supports a partial refund and leaves the payment PARTIALLY_REFUNDED', async () => {
    const { fixture, patient, appointment } = await setupPendingPaidAppointment(app);
    const paymentId = await payFor(patient.token, appointment.id);
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.PAYMENT_REFUND]);

    const res = await request(app).post(`/api/v1/payments/${paymentId}/refund`).set('Authorization', `Bearer ${staff.token}`).send({ amount: 200, reason: 'Partial goodwill refund' });
    expect(res.status).toBe(200);
    expect(res.body.data.payment.status).toBe('PARTIALLY_REFUNDED');
    expect(res.body.data.payment.refundedAmount).toBe(200);

    // A second partial refund for the remaining balance completes it.
    const second = await request(app).post(`/api/v1/payments/${paymentId}/refund`).set('Authorization', `Bearer ${staff.token}`).send({ amount: 300, reason: 'Remaining balance' });
    expect(second.status).toBe(200);
    expect(second.body.data.payment.status).toBe('REFUNDED');
    expect(second.body.data.payment.refundedAmount).toBe(500);
  });

  it('rejects a refund amount exceeding the remaining refundable balance', async () => {
    const { fixture, patient, appointment } = await setupPendingPaidAppointment(app);
    const paymentId = await payFor(patient.token, appointment.id);
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.PAYMENT_REFUND]);

    const res = await request(app).post(`/api/v1/payments/${paymentId}/refund`).set('Authorization', `Bearer ${staff.token}`).send({ amount: 1000, reason: 'Too much' });
    expect(res.status).toBe(400);
  });

  it('rejects refunding a payment that was created but never captured', async () => {
    const { fixture, patient, appointment } = await setupPendingPaidAppointment(app);
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.PAYMENT_REFUND]);
    const orderRes = await request(app).post('/api/v1/payments/create-order').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appointment.id });
    const paymentId = orderRes.body.data.order.paymentId as string;

    const res = await request(app).post(`/api/v1/payments/${paymentId}/refund`).set('Authorization', `Bearer ${staff.token}`).send({ reason: 'n/a' });
    expect(res.status).toBe(409);
  });

  it('returns 404 for a refund against a nonexistent payment id', async () => {
    const { fixture } = await setupPendingPaidAppointment(app);
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.PAYMENT_REFUND]);
    const res = await request(app).post('/api/v1/payments/00000000-0000-0000-0000-000000000000/refund').set('Authorization', `Bearer ${staff.token}`).send({ reason: 'n/a' });
    expect(res.status).toBe(404);
  });

  it('cancelling a paid appointment auto-triggers an eligible refund', async () => {
    const { patient, appointment } = await setupPendingPaidAppointment(app);
    const paymentId = await payFor(patient.token, appointment.id);

    const cancelRes = await request(app).post(`/api/v1/appointments/${appointment.id}/cancel`).set('Authorization', `Bearer ${patient.token}`).send({ reason: 'Feeling better' });
    expect(cancelRes.status).toBe(200);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe('REFUNDED');
    expect(payment.refundedAmount.toString()).toBe('500');
    const refund = await prisma.refund.findFirst({ where: { paymentId } });
    expect(refund).not.toBeNull();
    expect(refund!.reason).toBe('Appointment cancelled');
  });

  it('respects a clinic-configured partial refund-on-cancellation policy', async () => {
    const { patient, appointment } = await setupPendingPaidAppointment(app, { refundOnCancellationPercent: 50 });
    const paymentId = await payFor(patient.token, appointment.id);

    const cancelRes = await request(app).post(`/api/v1/appointments/${appointment.id}/cancel`).set('Authorization', `Bearer ${patient.token}`).send({ reason: 'Schedule conflict' });
    expect(cancelRes.status).toBe(200);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe('PARTIALLY_REFUNDED');
    expect(payment.refundedAmount.toString()).toBe('250');
  });
});
