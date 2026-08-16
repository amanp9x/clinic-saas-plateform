import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { CLINIC_PERMISSIONS } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const {
  createDoctorFixture,
  createPatientFixture,
  createDoctorAvailabilityFixture,
  createClinicWorkingHoursFixture,
  tomorrowInfo,
  atTime,
} = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');
const { enableOnlinePayment } = await import('../helpers/payment-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

describe('End-to-end payment smoke test', () => {
  it('discovery -> slot hold -> booking -> payment order -> verify -> confirmation -> invoice -> receipt -> portal visibility', async () => {
    const fixture = await createDoctorFixture(app);
    await enableOnlinePayment(fixture.clinicId);
    const { date, weekday, dateObj } = tomorrowInfo();
    await createClinicWorkingHoursFixture(fixture.clinicId, { weekday, sessions: [{ startTime: '09:00', endTime: '13:00' }] });
    await createDoctorAvailabilityFixture(fixture.clinicDoctorId, { weekday, startTime: '09:00', endTime: '13:00', consultationDurationMinutes: 15 });
    const slot = atTime(dateObj, '09:00');

    // 1. Patient login (fixture) + search doctor / select clinic / select slot (availability).
    const patient = await createPatientFixture(app);
    const availRes = await request(app).get(`/api/v1/appointments/availability?doctorId=${fixture.doctorId}&clinicId=${fixture.clinicId}&date=${date}`);
    expect(availRes.status).toBe(200);
    expect(availRes.body.data.slots[0].status).toBe('AVAILABLE');

    // 2. Create booking via an explicit slot hold (not direct-book), matching the full spec'd flow.
    const holdRes = await request(app)
      .post('/api/v1/appointments/hold')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC' });
    expect(holdRes.status).toBe(201);
    const holdId = holdRes.body.data.hold.id as string;

    const bookRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ holdId, appointmentType: 'NEW_CONSULTATION' });
    expect(bookRes.status).toBe(201);
    const appointment = bookRes.body.data.appointment as { id: string; status: string; bookingReference: string };
    expect(appointment.status).toBe('PENDING'); // awaiting payment — not yet confirmed

    // 3. Create payment order (server-priced).
    const orderRes = await request(app).post('/api/v1/payments/create-order').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appointment.id });
    expect(orderRes.status).toBe(201);
    const order = orderRes.body.data.order as { paymentId: string; providerOrderId: string; amount: number };
    expect(order.amount).toBe(500);

    // 4. Complete mock/test payment (stands in for the real checkout SDK's success callback).
    const simRes = await request(app).post(`/api/v1/payments/${order.paymentId}/simulate`).set('Authorization', `Bearer ${patient.token}`).send({ outcome: 'success' });
    expect(simRes.status).toBe(200);
    const checkout = simRes.body.data as { providerPaymentId: string; providerSignature: string };

    // 5. Verify payment (server-side, source of truth).
    const verifyRes = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ paymentId: order.paymentId, providerOrderId: order.providerOrderId, providerPaymentId: checkout.providerPaymentId, providerSignature: checkout.providerSignature });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.payment.status).toBe('CAPTURED');

    // 6. Appointment confirmation.
    const apptAfter = await request(app).get(`/api/v1/appointments/${appointment.id}`).set('Authorization', `Bearer ${patient.token}`);
    expect(apptAfter.body.data.appointment.status).toBe('CONFIRMED');
    expect(apptAfter.body.data.appointment.paymentStatus).toBe('CAPTURED');

    // 7. Invoice + receipt.
    const invoice = await prisma.invoice.findUnique({ where: { paymentId: order.paymentId } });
    expect(invoice).not.toBeNull();
    expect(invoice!.invoiceNumber).toMatch(/^INV-\d{4}-\d{6}$/);
    const receiptRes = await request(app).get(`/api/v1/payments/${order.paymentId}/receipt`).set('Authorization', `Bearer ${patient.token}`);
    expect(receiptRes.status).toBe(200);
    expect(receiptRes.headers['content-type']).toBe('application/pdf');

    // 8. Patient Portal payment visibility (payment history list).
    const historyRes = await request(app).get('/api/v1/payments').set('Authorization', `Bearer ${patient.token}`);
    expect(historyRes.body.data.items.some((p: { id: string }) => p.id === order.paymentId)).toBe(true);

    // 9. Reception payment visibility.
    const reception = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.APPOINTMENT_MANAGE, CLINIC_PERMISSIONS.QUEUE_VIEW]);
    const receptionList = await request(app).get(`/api/v1/reception/appointments?clinicId=${fixture.clinicId}&tab=upcoming`).set('Authorization', `Bearer ${reception.token}`);
    const receptionRow = receptionList.body.data.appointments.items.find((a: { id: string }) => a.id === appointment.id);
    expect(receptionRow).toBeTruthy();
    expect(receptionRow.paymentStatus).toBe('CAPTURED');
  });

  it('payment failure -> retry -> successful payment reaches CONFIRMED with exactly one appointment', async () => {
    const fixture = await createDoctorFixture(app);
    await enableOnlinePayment(fixture.clinicId);
    const { weekday, dateObj } = tomorrowInfo();
    await createClinicWorkingHoursFixture(fixture.clinicId, { weekday, sessions: [{ startTime: '09:00', endTime: '13:00' }] });
    await createDoctorAvailabilityFixture(fixture.clinicDoctorId, { weekday, startTime: '09:00', endTime: '13:00', consultationDurationMinutes: 15 });
    const slot = atTime(dateObj, '09:00');
    const patient = await createPatientFixture(app);

    const bookRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC', appointmentType: 'NEW_CONSULTATION' });
    const appointment = bookRes.body.data.appointment as { id: string };

    const orderRes = await request(app).post('/api/v1/payments/create-order').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appointment.id });
    const order = orderRes.body.data.order as { paymentId: string };
    const badSim = await request(app).post(`/api/v1/payments/${order.paymentId}/simulate`).set('Authorization', `Bearer ${patient.token}`).send({ outcome: 'success' });
    const badCheckout = badSim.body.data as { providerPaymentId: string; providerSignature: string; providerOrderId: string };
    const failRes = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ paymentId: order.paymentId, providerOrderId: badCheckout.providerOrderId, providerPaymentId: badCheckout.providerPaymentId, providerSignature: `${badCheckout.providerSignature}deadbeef` });
    expect(failRes.status).toBe(400);

    const retryRes = await request(app).post(`/api/v1/payments/${order.paymentId}/retry`).set('Authorization', `Bearer ${patient.token}`);
    expect(retryRes.status).toBe(200);
    const retryOrder = retryRes.body.data.order as { providerOrderId: string };

    const goodSim = await request(app).post(`/api/v1/payments/${order.paymentId}/simulate`).set('Authorization', `Bearer ${patient.token}`).send({ outcome: 'success' });
    const goodCheckout = goodSim.body.data as { providerPaymentId: string; providerSignature: string };
    const verifyRes = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ paymentId: order.paymentId, providerOrderId: retryOrder.providerOrderId, providerPaymentId: goodCheckout.providerPaymentId, providerSignature: goodCheckout.providerSignature });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.payment.status).toBe('CAPTURED');

    const appointmentCount = await prisma.appointment.count({ where: { id: appointment.id } });
    expect(appointmentCount).toBe(1);
    const apptFinal = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(apptFinal.status).toBe('CONFIRMED');
  });

  it('payment success -> cancellation -> refund', async () => {
    const fixture = await createDoctorFixture(app);
    await enableOnlinePayment(fixture.clinicId);
    const { weekday, dateObj } = tomorrowInfo();
    await createClinicWorkingHoursFixture(fixture.clinicId, { weekday, sessions: [{ startTime: '09:00', endTime: '13:00' }] });
    await createDoctorAvailabilityFixture(fixture.clinicDoctorId, { weekday, startTime: '09:00', endTime: '13:00', consultationDurationMinutes: 15 });
    const slot = atTime(dateObj, '09:00');
    const patient = await createPatientFixture(app);

    const bookRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC', appointmentType: 'NEW_CONSULTATION' });
    const appointment = bookRes.body.data.appointment as { id: string };

    const orderRes = await request(app).post('/api/v1/payments/create-order').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appointment.id });
    const order = orderRes.body.data.order as { paymentId: string; providerOrderId: string };
    const sim = await request(app).post(`/api/v1/payments/${order.paymentId}/simulate`).set('Authorization', `Bearer ${patient.token}`).send({ outcome: 'success' });
    const checkout = sim.body.data as { providerPaymentId: string; providerSignature: string };
    await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ paymentId: order.paymentId, providerOrderId: order.providerOrderId, providerPaymentId: checkout.providerPaymentId, providerSignature: checkout.providerSignature });

    const cancelRes = await request(app).post(`/api/v1/appointments/${appointment.id}/cancel`).set('Authorization', `Bearer ${patient.token}`).send({ reason: 'Plans changed' });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.appointment.status).toBe('CANCELLED');

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: order.paymentId } });
    expect(payment.status).toBe('REFUNDED');
    const refund = await prisma.refund.findFirstOrThrow({ where: { paymentId: order.paymentId } });
    expect(refund.status).toBe('REFUNDED');
    expect(refund.amount.toString()).toBe('500');
  });
});
