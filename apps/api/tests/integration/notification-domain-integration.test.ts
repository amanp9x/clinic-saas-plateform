import { describe, expect, it } from 'vitest';
import request from 'supertest';

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
const { setupPendingPaidAppointment } = await import('../helpers/payment-fixtures.js');
const { prisma } = await import('../../src/config/database.js');
const { CLINIC_PERMISSIONS } = await import('@clinic/shared');

const app = createApp();

async function setupBookableDoctor() {
  const fixture = await createDoctorFixture(app);
  const { weekday, dateObj } = tomorrowInfo();
  await createClinicWorkingHoursFixture(fixture.clinicId, { weekday, sessions: [{ startTime: '09:00', endTime: '13:00' }] });
  await createDoctorAvailabilityFixture(fixture.clinicDoctorId, { weekday, startTime: '09:00', endTime: '13:00', consultationDurationMinutes: 15 });
  return { fixture, dateObj };
}

async function latestNotification(userId: string, type: string) {
  return prisma.notification.findFirst({ where: { userId, type: type as never }, orderBy: { createdAt: 'desc' } });
}

describe('Appointment notifications', () => {
  it('booking a free appointment sends APPOINTMENT_CONFIRMED to the patient', async () => {
    const { fixture, dateObj } = await setupBookableDoctor();
    const patient = await createPatientFixture(app);
    const slot = atTime(dateObj, '09:00');

    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC', appointmentType: 'NEW_CONSULTATION' });
    expect(res.status).toBe(201);

    const notif = await latestNotification(patient.userId, 'APPOINTMENT_CONFIRMED');
    expect(notif).not.toBeNull();
    expect(notif!.relatedEntityId).toBe(res.body.data.appointment.id);
  });

  it('a payment-gated booking sends APPOINTMENT_BOOKED (not CONFIRMED) while PENDING', async () => {
    const { appointment, patient } = await setupPendingPaidAppointment(app);
    const notif = await latestNotification(patient.userId, 'APPOINTMENT_BOOKED');
    expect(notif).not.toBeNull();
    expect(notif!.relatedEntityId).toBe(appointment.id);
    const confirmedYet = await latestNotification(patient.userId, 'APPOINTMENT_CONFIRMED');
    expect(confirmedYet).toBeNull();
  });

  it('reschedule sends APPOINTMENT_RESCHEDULED, cancel sends APPOINTMENT_CANCELLED', async () => {
    const { fixture, dateObj } = await setupBookableDoctor();
    const patient = await createPatientFixture(app);
    const slot = atTime(dateObj, '09:00');
    const newSlot = atTime(dateObj, '09:15');

    const bookRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC', appointmentType: 'NEW_CONSULTATION' });
    const appointmentId = bookRes.body.data.appointment.id;

    await request(app)
      .patch(`/api/v1/appointments/${appointmentId}/reschedule`)
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ newScheduledAt: newSlot.toISOString() });
    const rescheduled = await latestNotification(patient.userId, 'APPOINTMENT_RESCHEDULED');
    expect(rescheduled).not.toBeNull();

    await request(app).post(`/api/v1/appointments/${appointmentId}/cancel`).set('Authorization', `Bearer ${patient.token}`).send({ reason: 'test' });
    const cancelled = await latestNotification(patient.userId, 'APPOINTMENT_CANCELLED');
    expect(cancelled).not.toBeNull();
  });

  it('reception check-in sends APPOINTMENT_CHECKED_IN, and doctor no-show sends APPOINTMENT_NO_SHOW', async () => {
    const { fixture, dateObj } = await setupBookableDoctor();
    const patient = await createPatientFixture(app);
    const reception = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.APPOINTMENT_MANAGE, CLINIC_PERMISSIONS.PATIENT_CHECKIN]);
    const slot = atTime(dateObj, '09:00');

    const bookRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC', appointmentType: 'NEW_CONSULTATION' });
    const appointmentId = bookRes.body.data.appointment.id;

    const checkinRes = await request(app).post('/api/v1/reception/checkin').set('Authorization', `Bearer ${reception.token}`).send({ appointmentId });
    expect(checkinRes.status).toBe(200);
    const checkedIn = await latestNotification(patient.userId, 'APPOINTMENT_CHECKED_IN');
    expect(checkedIn).not.toBeNull();

    const noShowRes = await request(app).post(`/api/v1/doctor/appointments/${appointmentId}/no-show`).set('Authorization', `Bearer ${fixture.token}`);
    expect(noShowRes.status).toBe(200);
    const noShow = await latestNotification(patient.userId, 'APPOINTMENT_NO_SHOW');
    expect(noShow).not.toBeNull();
  });
});

describe('Payment/refund notifications', () => {
  it('sends PAYMENT_PENDING on order creation and PAYMENT_SUCCESS on capture', async () => {
    const { patient, appointment } = await setupPendingPaidAppointment(app);

    const orderRes = await request(app).post('/api/v1/payments/create-order').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appointment.id });
    const order = orderRes.body.data.order as { paymentId: string; providerOrderId: string };
    const pending = await latestNotification(patient.userId, 'PAYMENT_PENDING');
    expect(pending).not.toBeNull();
    const simRes = await request(app).post(`/api/v1/payments/${order.paymentId}/simulate`).set('Authorization', `Bearer ${patient.token}`).send({ outcome: 'success' });
    const checkout = simRes.body.data as { providerPaymentId: string; providerSignature: string };
    await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ paymentId: order.paymentId, providerOrderId: order.providerOrderId, providerPaymentId: checkout.providerPaymentId, providerSignature: checkout.providerSignature });

    const success = await latestNotification(patient.userId, 'PAYMENT_SUCCESS');
    expect(success).not.toBeNull();
  });

  it('sends PAYMENT_FAILED on a failed verification', async () => {
    const { patient, appointment } = await setupPendingPaidAppointment(app);
    const orderRes = await request(app).post('/api/v1/payments/create-order').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appointment.id });
    const order = orderRes.body.data.order as { paymentId: string; providerOrderId: string };
    const simRes = await request(app).post(`/api/v1/payments/${order.paymentId}/simulate`).set('Authorization', `Bearer ${patient.token}`).send({ outcome: 'success' });
    const checkout = simRes.body.data as { providerPaymentId: string; providerSignature: string };
    await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ paymentId: order.paymentId, providerOrderId: order.providerOrderId, providerPaymentId: checkout.providerPaymentId, providerSignature: `${checkout.providerSignature}deadbeef` });

    const failed = await latestNotification(patient.userId, 'PAYMENT_FAILED');
    expect(failed).not.toBeNull();
  });

  it('sends PAYMENT_REFUNDED when a clinic refunds a captured payment', async () => {
    const { fixture, patient, appointment } = await setupPendingPaidAppointment(app);
    const orderRes = await request(app).post('/api/v1/payments/create-order').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appointment.id });
    const order = orderRes.body.data.order as { paymentId: string; providerOrderId: string };
    const simRes = await request(app).post(`/api/v1/payments/${order.paymentId}/simulate`).set('Authorization', `Bearer ${patient.token}`).send({ outcome: 'success' });
    const checkout = simRes.body.data as { providerPaymentId: string; providerSignature: string };
    await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ paymentId: order.paymentId, providerOrderId: order.providerOrderId, providerPaymentId: checkout.providerPaymentId, providerSignature: checkout.providerSignature });

    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.PAYMENT_REFUND]);
    await request(app).post(`/api/v1/payments/${order.paymentId}/refund`).set('Authorization', `Bearer ${staff.token}`).send({ reason: 'Patient request' });

    const refunded = await latestNotification(patient.userId, 'PAYMENT_REFUNDED');
    expect(refunded).not.toBeNull();
  });
});

describe('Queue delay notifications — dedup', () => {
  it('a small delay change does not spam a new notification, a large change does', async () => {
    const fixture = await createDoctorFixture(app, { canOverrideDelay: true });
    const { weekday, dateObj } = tomorrowInfo();
    await createClinicWorkingHoursFixture(fixture.clinicId, { weekday, sessions: [{ startTime: '09:00', endTime: '13:00' }] });
    await createDoctorAvailabilityFixture(fixture.clinicDoctorId, { weekday, startTime: '09:00', endTime: '13:00', consultationDurationMinutes: 15 });
    const patient = await createPatientFixture(app);
    const reception = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.APPOINTMENT_MANAGE, CLINIC_PERMISSIONS.PATIENT_CHECKIN]);
    const slot = atTime(dateObj, '09:00');

    const bookRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC', appointmentType: 'NEW_CONSULTATION' });
    await request(app).post('/api/v1/reception/checkin').set('Authorization', `Bearer ${reception.token}`).send({ appointmentId: bookRes.body.data.appointment.id });

    await request(app).post('/api/v1/doctor/queue/session/start').set('Authorization', `Bearer ${fixture.token}`).send({ clinicId: fixture.clinicId });

    const first = await request(app).patch('/api/v1/doctor/queue/delay').set('Authorization', `Bearer ${fixture.token}`).send({ clinicId: fixture.clinicId, delayMinutes: 10 });
    expect(first.status).toBe(200);
    const countAfterFirst = await prisma.notification.count({ where: { userId: patient.userId, type: 'DOCTOR_DELAYED' } });
    expect(countAfterFirst).toBe(1);

    // A minor fluctuation within the same 5-minute bucket must not create a second notification.
    await request(app).patch('/api/v1/doctor/queue/delay').set('Authorization', `Bearer ${fixture.token}`).send({ clinicId: fixture.clinicId, delayMinutes: 11 });
    const countAfterMinor = await prisma.notification.count({ where: { userId: patient.userId, type: 'DOCTOR_DELAYED' } });
    expect(countAfterMinor).toBe(1);

    // A real change (10 -> 20) crosses into a new bucket and must notify again.
    await request(app).patch('/api/v1/doctor/queue/delay').set('Authorization', `Bearer ${fixture.token}`).send({ clinicId: fixture.clinicId, delayMinutes: 20 });
    const countAfterBig = await prisma.notification.count({ where: { userId: patient.userId, type: 'DOCTOR_DELAYED' } });
    expect(countAfterBig).toBe(2);
  });
});

describe('Consultation and security notifications', () => {
  it('sends CONSULTATION_COMPLETED to the patient', async () => {
    const { fixture, dateObj } = await setupBookableDoctor();
    const patient = await createPatientFixture(app);
    const reception = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.APPOINTMENT_MANAGE, CLINIC_PERMISSIONS.PATIENT_CHECKIN]);
    const slot = atTime(dateObj, '09:00');

    const bookRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC', appointmentType: 'NEW_CONSULTATION' });
    const appointmentId = bookRes.body.data.appointment.id;
    await request(app).post('/api/v1/reception/checkin').set('Authorization', `Bearer ${reception.token}`).send({ appointmentId });
    await request(app).post(`/api/v1/doctor/appointments/${appointmentId}/start`).set('Authorization', `Bearer ${fixture.token}`);
    const completeRes = await request(app).post(`/api/v1/doctor/consultations/${appointmentId}/complete`).set('Authorization', `Bearer ${fixture.token}`);
    expect(completeRes.status).toBe(200);

    const notif = await latestNotification(patient.userId, 'CONSULTATION_COMPLETED');
    expect(notif).not.toBeNull();
  });

  it('sends SECURITY_LOGIN on login and SECURITY_PASSWORD_CHANGED on password change', async () => {
    const patient = await createPatientFixture(app);
    const { FRESH_PATIENT_PASSWORD } = await import('../helpers/doctor-fixtures.js');
    const user = await prisma.user.findUniqueOrThrow({ where: { id: patient.userId } });

    const loginRes = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: FRESH_PATIENT_PASSWORD });
    expect(loginRes.status).toBe(200);
    const loginCount = await prisma.notification.count({ where: { userId: patient.userId, type: 'SECURITY_LOGIN' } });
    expect(loginCount).toBeGreaterThanOrEqual(1);

    const changeRes = await request(app)
      .post('/api/v1/auth/password/change')
      .set('Authorization', `Bearer ${loginRes.body.data.accessToken}`)
      .send({ currentPassword: FRESH_PATIENT_PASSWORD, newPassword: 'NewFreshPat123!' });
    expect(changeRes.status).toBe(200);
    const changed = await latestNotification(patient.userId, 'SECURITY_PASSWORD_CHANGED');
    expect(changed).not.toBeNull();
  });
});
