import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { UserRole, CLINIC_PERMISSIONS } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

async function adminFor(clinicId: string) {
  return createReceptionFixture(app, clinicId, [], { role: UserRole.CLINIC_ADMIN });
}

describe('MANDATORY: two simultaneous analytics requests return consistent results', () => {
  it('two concurrent overview requests for the same clinic/range return identical figures', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const admin = await adminFor(fixture.clinicId);
    for (let i = 0; i < 8; i++) {
      await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: i % 2 === 0 ? 'COMPLETED' : 'CANCELLED' });
    }

    const [a, b] = await Promise.all([
      request(app).get('/api/v1/analytics/overview').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${admin.token}`),
      request(app).get('/api/v1/analytics/overview').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${admin.token}`),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body.data.appointments).toEqual(b.body.data.appointments);
    expect(a.body.data.revenue).toEqual(b.body.data.revenue);
  });
});

describe('MANDATORY: two simultaneous exports with the same filters return identical authorized datasets', () => {
  it('two concurrent CSV exports produce byte-identical output', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const admin = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.ANALYTICS_VIEW, CLINIC_PERMISSIONS.ANALYTICS_EXPORT]);
    for (let i = 0; i < 5; i++) {
      await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });
    }

    const [a, b] = await Promise.all([
      request(app).get('/api/v1/analytics/export/appointments').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${admin.token}`),
      request(app).get('/api/v1/analytics/export/appointments').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${admin.token}`),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.text).toBe(b.text);
  });
});

describe('MANDATORY: concurrent booking/payment state changes never produce impossible analytics', () => {
  it('two simultaneous refund requests on the same payment: analytics reflects exactly one refund, never double-counted', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.PAYMENT_REFUND, CLINIC_PERMISSIONS.ANALYTICS_REVENUE_VIEW]);
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });
    const payment = await prisma.payment.create({
      data: {
        appointmentId: appt.id,
        patientId: patient.patientId,
        doctorId: fixture.doctorId,
        clinicId: fixture.clinicId,
        provider: 'MOCK',
        status: 'CAPTURED',
        subtotal: 1000,
        amount: 1000,
        currency: 'INR',
        capturedAmount: 1000,
        capturedAt: new Date(),
        providerPaymentId: `pay_concurrency_${appt.id}`,
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });

    const [r1, r2] = await Promise.all([
      request(app).post(`/api/v1/payments/${payment.id}/refund`).set('Authorization', `Bearer ${staff.token}`).send({ reason: 'race A' }),
      request(app).post(`/api/v1/payments/${payment.id}/refund`).set('Authorization', `Bearer ${staff.token}`).send({ reason: 'race B' }),
    ]);
    const statuses = [r1.status, r2.status].sort();
    // Exactly one refund request succeeds; the other is rejected as "already in progress" (409) —
    // the same guarantee proven in Phase 9's own mandatory concurrency test, reused here.
    expect(statuses).toEqual([200, 409]);

    const refundCount = await prisma.refund.count({ where: { paymentId: payment.id } });
    expect(refundCount).toBe(1);

    const res = await request(app).get('/api/v1/analytics/revenue').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${staff.token}`);
    expect(res.status).toBe(200);
    // refundedAmount reflects exactly the one successful refund — never double-counted despite the
    // race. A fully-refunded payment is excluded from "gross collected" (matching the existing
    // clinicBillingTotals CAPTURED+PARTIALLY_REFUNDED-only convention — see analytics.repository.ts),
    // so netCollected = 0 - 1000, not some doubled/impossible value like -2000.
    expect(res.body.data.breakdown.refundedAmount).toBe(1000);
    expect(res.body.data.breakdown.netCollected).toBe(-1000);
  });

  it('a concurrent capture race (verify vs webhook-equivalent) still yields exactly one CAPTURED payment reflected once in revenue', async () => {
    const { setupPendingPaidAppointment } = await import('../helpers/payment-fixtures.js');
    const { fixture, patient, appointment } = await setupPendingPaidAppointment(app);
    const admin = await adminFor(fixture.clinicId);
    const orderRes = await request(app).post('/api/v1/payments/create-order').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appointment.id });
    const order = orderRes.body.data.order as { paymentId: string; providerOrderId: string };
    const simRes = await request(app).post(`/api/v1/payments/${order.paymentId}/simulate`).set('Authorization', `Bearer ${patient.token}`).send({ outcome: 'success' });
    const checkout = simRes.body.data as { providerPaymentId: string; providerSignature: string };

    const verifyOnce = () =>
      request(app)
        .post('/api/v1/payments/verify')
        .set('Authorization', `Bearer ${patient.token}`)
        .send({ paymentId: order.paymentId, providerOrderId: order.providerOrderId, providerPaymentId: checkout.providerPaymentId, providerSignature: checkout.providerSignature });

    const [v1, v2] = await Promise.all([verifyOnce(), verifyOnce()]);
    expect([v1.status, v2.status]).toEqual([200, 200]); // both idempotently succeed per Phase 9's design

    const capturedCount = await prisma.payment.count({ where: { id: order.paymentId, status: { in: ['CAPTURED', 'PARTIALLY_REFUNDED', 'REFUNDED'] } } });
    expect(capturedCount).toBe(1);

    const res = await request(app).get('/api/v1/analytics/revenue').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${admin.token}`);
    expect(res.body.data.breakdown.successfulPaymentCount).toBe(1); // never double-counted despite two concurrent verify calls
  });
});
