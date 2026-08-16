import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { CLINIC_PERMISSIONS } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { setupPendingPaidAppointment } = await import('../helpers/payment-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');

const app = createApp();

async function payFor(patientToken: string, appointmentId: string) {
  const orderRes = await request(app).post('/api/v1/payments/create-order').set('Authorization', `Bearer ${patientToken}`).send({ appointmentId });
  const order = orderRes.body.data.order as { paymentId: string; providerOrderId: string };
  const simRes = await request(app).post(`/api/v1/payments/${order.paymentId}/simulate`).set('Authorization', `Bearer ${patientToken}`).send({ outcome: 'success' });
  const checkout = simRes.body.data as { providerPaymentId: string; providerSignature: string };
  await request(app)
    .post('/api/v1/payments/verify')
    .set('Authorization', `Bearer ${patientToken}`)
    .send({ paymentId: order.paymentId, providerOrderId: order.providerOrderId, providerPaymentId: checkout.providerPaymentId, providerSignature: checkout.providerSignature });
  return order.paymentId;
}

describe('GET /api/v1/clinic/billing', () => {
  it('rejects a patient and a receptionist without BILLING_VIEW', async () => {
    const { fixture, patient } = await setupPendingPaidAppointment(app);
    const asPatient = await request(app).get(`/api/v1/clinic/billing?clinicId=${fixture.clinicId}`).set('Authorization', `Bearer ${patient.token}`);
    expect(asPatient.status).toBe(403);

    const noPerm = await createReceptionFixture(app, fixture.clinicId, []);
    const denied = await request(app).get(`/api/v1/clinic/billing?clinicId=${fixture.clinicId}`).set('Authorization', `Bearer ${noPerm.token}`);
    expect(denied.status).toBe(403);
  });

  it('shows collected/pending totals and a filterable payment list for authorized staff', async () => {
    const { fixture, patient, appointment } = await setupPendingPaidAppointment(app);
    await payFor(patient.token, appointment.id);
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.BILLING_VIEW]);

    const res = await request(app).get(`/api/v1/clinic/billing?clinicId=${fixture.clinicId}`).set('Authorization', `Bearer ${staff.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.summary.totalCollected).toBeGreaterThanOrEqual(500);
    expect(res.body.data.items.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.items.items[0].status).toBe('CAPTURED');

    const filtered = await request(app).get(`/api/v1/clinic/billing?clinicId=${fixture.clinicId}&status=CAPTURED&doctorId=${fixture.doctorId}`).set('Authorization', `Bearer ${staff.token}`);
    expect(filtered.status).toBe(200);
    expect(filtered.body.data.items.items.every((p: { status: string }) => p.status === 'CAPTURED')).toBe(true);
  });

  it('isolates billing data per clinic', async () => {
    const { fixture: clinicA, patient, appointment } = await setupPendingPaidAppointment(app);
    await payFor(patient.token, appointment.id);

    const { createDoctorFixture } = await import('../helpers/doctor-fixtures.js');
    const clinicB = await createDoctorFixture(app);
    const staffB = await createReceptionFixture(app, clinicB.clinicId, [CLINIC_PERMISSIONS.BILLING_VIEW]);

    const res = await request(app).get(`/api/v1/clinic/billing?clinicId=${clinicB.clinicId}`).set('Authorization', `Bearer ${staffB.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.items.some((p: { appointmentId: string }) => p.appointmentId === appointment.id)).toBe(false);
    void clinicA;
  });
});

describe('GET /api/v1/payments (patient payment history)', () => {
  it('lists only the authenticated patient’s own payments, paginated', async () => {
    const { patient, appointment } = await setupPendingPaidAppointment(app);
    await payFor(patient.token, appointment.id);

    const res = await request(app).get('/api/v1/payments?page=1&limit=10').set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.items[0].status).toBe('CAPTURED');

    const { createPatientFixture } = await import('../helpers/doctor-fixtures.js');
    const stranger = await createPatientFixture(app);
    const strangerRes = await request(app).get('/api/v1/payments').set('Authorization', `Bearer ${stranger.token}`);
    expect(strangerRes.status).toBe(200);
    expect(strangerRes.body.data.items).toHaveLength(0);
  });
});

describe('GET /api/v1/payments/:id/receipt', () => {
  it('returns a PDF receipt after a successful payment', async () => {
    const { patient, appointment } = await setupPendingPaidAppointment(app);
    const paymentId = await payFor(patient.token, appointment.id);

    const res = await request(app).get(`/api/v1/payments/${paymentId}/receipt`).set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.body.length).toBeGreaterThan(100);
  });

  it('returns 409 when no invoice exists yet (payment not captured)', async () => {
    const { patient, appointment } = await setupPendingPaidAppointment(app);
    const orderRes = await request(app).post('/api/v1/payments/create-order').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appointment.id });
    const paymentId = orderRes.body.data.order.paymentId as string;

    const res = await request(app).get(`/api/v1/payments/${paymentId}/receipt`).set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(409);
  });
});
