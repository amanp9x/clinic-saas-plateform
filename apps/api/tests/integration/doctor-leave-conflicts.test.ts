import { describe, expect, it } from 'vitest';
import request from 'supertest';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture, tomorrowInfo, atTime } = await import('../helpers/doctor-fixtures.js');
const { setupPendingPaidAppointment } = await import('../helpers/payment-fixtures.js');
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

describe('POST /api/v1/doctor/leaves — conflict cancellation', () => {
  it('cancels a CONFIRMED appointment that falls inside the leave range and notifies the patient', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const { date, dateObj } = tomorrowInfo();
    const appt = await createAppointmentFixture({
      patientId: patient.patientId,
      doctorId: fixture.doctorId,
      clinicId: fixture.clinicId,
      status: 'CONFIRMED',
      scheduledAt: atTime(dateObj, '10:00'),
    });

    const res = await request(app)
      .post('/api/v1/doctor/leaves')
      .set('Authorization', `Bearer ${fixture.token}`)
      .send({ startDate: date, endDate: date, type: 'LEAVE', reason: 'Family emergency' });
    expect(res.status).toBe(201);
    expect(res.body.data.cancelledAppointments).toHaveLength(1);
    expect(res.body.data.cancelledAppointments[0].appointmentId).toBe(appt.id);

    const updated = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    expect(updated.status).toBe('CANCELLED');
    expect(updated.cancelSource).toBe('DOCTOR');

    const notif = await prisma.notification.findUnique({ where: { notificationKey: `appointment:${appt.id}:cancelled` } });
    expect(notif).not.toBeNull();
    expect(notif!.userId).toBe(patient.userId);
  });

  it('does not touch an appointment outside the leave date range', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const { dateObj } = tomorrowInfo();
    const dayAfter = new Date(dateObj.getTime() + 2 * 24 * 60 * 60_000);

    const appt = await createAppointmentFixture({
      patientId: patient.patientId,
      doctorId: fixture.doctorId,
      clinicId: fixture.clinicId,
      status: 'CONFIRMED',
      scheduledAt: atTime(dayAfter, '10:00'),
    });

    const { date } = tomorrowInfo();
    const res = await request(app)
      .post('/api/v1/doctor/leaves')
      .set('Authorization', `Bearer ${fixture.token}`)
      .send({ startDate: date, endDate: date, type: 'LEAVE' });
    expect(res.status).toBe(201);
    expect(res.body.data.cancelledAppointments).toHaveLength(0);

    const untouched = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    expect(untouched.status).toBe('CONFIRMED');
  });

  it('a clinic-scoped leave only cancels appointments at that clinic, leaving the doctor other clinic untouched', async () => {
    const fixtureA = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const { date, dateObj } = tomorrowInfo();

    const apptAtA = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixtureA.doctorId, clinicId: fixtureA.clinicId, status: 'CONFIRMED', scheduledAt: atTime(dateObj, '09:00') });

    // Same doctor, second clinic — associate directly (mirrors how ClinicDoctor associations are
    // modeled elsewhere; a doctor can practice at more than one clinic).
    const clinicB = await prisma.clinic.create({ data: { name: 'Second Clinic', slug: `second-clinic-${apptAtA.id}` } });
    await prisma.clinicDoctor.create({ data: { clinicId: clinicB.id, doctorId: fixtureA.doctorId } });
    const apptAtB = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixtureA.doctorId, clinicId: clinicB.id, status: 'CONFIRMED', scheduledAt: atTime(dateObj, '11:00') });

    const res = await request(app)
      .post('/api/v1/doctor/leaves')
      .set('Authorization', `Bearer ${fixtureA.token}`)
      .send({ startDate: date, endDate: date, clinicId: fixtureA.clinicId, type: 'LEAVE' });
    expect(res.status).toBe(201);
    expect(res.body.data.cancelledAppointments.map((c: { appointmentId: string }) => c.appointmentId)).toEqual([apptAtA.id]);

    const untouched = await prisma.appointment.findUniqueOrThrow({ where: { id: apptAtB.id } });
    expect(untouched.status).toBe('CONFIRMED');
  });

  it('a COMPLETED appointment inside the range is left alone (not cancellable)', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const { date, dateObj } = tomorrowInfo();
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED', scheduledAt: atTime(dateObj, '09:00') });

    const res = await request(app)
      .post('/api/v1/doctor/leaves')
      .set('Authorization', `Bearer ${fixture.token}`)
      .send({ startDate: date, endDate: date, type: 'LEAVE' });
    expect(res.status).toBe(201);
    expect(res.body.data.cancelledAppointments).toHaveLength(0);

    const untouched = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    expect(untouched.status).toBe('COMPLETED');
  });

  it('records an audit log entry with the cancelled-appointment count', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const { date, dateObj } = tomorrowInfo();
    await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'CONFIRMED', scheduledAt: atTime(dateObj, '09:00') });

    const res = await request(app)
      .post('/api/v1/doctor/leaves')
      .set('Authorization', `Bearer ${fixture.token}`)
      .send({ startDate: date, endDate: date, type: 'LEAVE' });
    expect(res.status).toBe(201);

    const auditRow = await prisma.auditLog.findFirst({ where: { entityType: 'DoctorLeave', entityId: res.body.data.leave.id, action: 'doctor.leave_created' } });
    expect(auditRow).not.toBeNull();
    expect((auditRow!.metadata as { cancelledAppointmentCount: number }).cancelledAppointmentCount).toBe(1);
  });

  it('cancels a captured payment along with the appointment (reuses the existing refund path)', async () => {
    const { fixture, patient, appointment } = await setupPendingPaidAppointment(app);
    const paymentId = await payFor(patient.token, appointment.id);

    const { date } = tomorrowInfo();
    const res = await request(app)
      .post('/api/v1/doctor/leaves')
      .set('Authorization', `Bearer ${fixture.token}`)
      .send({ startDate: date, endDate: date, type: 'LEAVE' });
    expect(res.status).toBe(201);
    expect(res.body.data.cancelledAppointments).toHaveLength(1);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(['REFUND_PENDING', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED']).toContain(payment.status);
  });
});

describe('MANDATORY: two concurrent leave creations racing on the same conflicting appointment never double-cancel or double-notify', () => {
  it('both leave-creation requests succeed at the HTTP layer, but the appointment is cancelled exactly once with exactly one notification', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const { date, dateObj } = tomorrowInfo();
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'CONFIRMED', scheduledAt: atTime(dateObj, '09:00') });

    const [a, b] = await Promise.all([
      request(app).post('/api/v1/doctor/leaves').set('Authorization', `Bearer ${fixture.token}`).send({ startDate: date, endDate: date, type: 'LEAVE' }),
      request(app).post('/api/v1/doctor/leaves').set('Authorization', `Bearer ${fixture.token}`).send({ startDate: date, endDate: date, type: 'LEAVE' }),
    ]);

    expect([a.status, b.status]).toEqual([201, 201]);

    const totalCancelledInResponses = a.body.data.cancelledAppointments.length + b.body.data.cancelledAppointments.length;
    expect(totalCancelledInResponses).toBe(1);

    const finalAppt = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    expect(finalAppt.status).toBe('CANCELLED');

    const notifCount = await prisma.notification.count({ where: { notificationKey: `appointment:${appt.id}:cancelled` } });
    expect(notifCount).toBe(1);
  });
});
