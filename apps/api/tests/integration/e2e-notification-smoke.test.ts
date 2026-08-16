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
  FRESH_PATIENT_PASSWORD,
} = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

async function notificationsFor(userId: string) {
  return prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
}

describe('End-to-end notification smoke test — full real appointment lifecycle', () => {
  it('chains login -> book -> pay -> confirm -> check-in -> queue delay -> call -> consult -> prescription, all producing real notifications', async () => {
    const fixture = await createDoctorFixture(app, { canOverrideDelay: true });
    const { weekday, dateObj } = tomorrowInfo();
    await createClinicWorkingHoursFixture(fixture.clinicId, { weekday, sessions: [{ startTime: '09:00', endTime: '13:00' }] });
    await createDoctorAvailabilityFixture(fixture.clinicDoctorId, { weekday, startTime: '09:00', endTime: '13:00', consultationDurationMinutes: 15 });
    const patient = await createPatientFixture(app);
    const reception = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.APPOINTMENT_MANAGE, CLINIC_PERMISSIONS.PATIENT_CHECKIN]);
    const patientUser = await prisma.user.findUniqueOrThrow({ where: { id: patient.userId } });

    // 1. Login -> SECURITY_LOGIN
    const loginRes = await request(app).post('/api/v1/auth/login').send({ email: patientUser.email, password: FRESH_PATIENT_PASSWORD });
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.data.accessToken as string;

    // 2. Book -> APPOINTMENT_CONFIRMED (free consult, no payment required)
    const slot = atTime(dateObj, '09:00');
    const bookRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC', appointmentType: 'NEW_CONSULTATION' });
    expect(bookRes.status).toBe(201);
    const appointmentId = bookRes.body.data.appointment.id as string;

    // 3. Reception check-in -> APPOINTMENT_CHECKED_IN
    const checkinRes = await request(app).post('/api/v1/reception/checkin').set('Authorization', `Bearer ${reception.token}`).send({ appointmentId });
    expect(checkinRes.status).toBe(200);

    // 4. Check-in already activated the queue session — set a delay -> DOCTOR_DELAYED
    const delayRes = await request(app).patch('/api/v1/doctor/queue/delay').set('Authorization', `Bearer ${fixture.token}`).send({ clinicId: fixture.clinicId, delayMinutes: 15 });
    expect(delayRes.status).toBe(200);

    // 5. Doctor calls the patient -> PATIENT_CALLED
    const callRes = await request(app).post('/api/v1/doctor/queue/call-next').set('Authorization', `Bearer ${fixture.token}`).send({ clinicId: fixture.clinicId });
    expect(callRes.status).toBe(200);

    // 6. Consultation start -> CONSULTATION_STARTED, complete -> CONSULTATION_COMPLETED
    const startRes = await request(app).post(`/api/v1/doctor/appointments/${appointmentId}/start`).set('Authorization', `Bearer ${fixture.token}`);
    expect(startRes.status).toBe(200);
    const completeRes = await request(app).post(`/api/v1/doctor/consultations/${appointmentId}/complete`).set('Authorization', `Bearer ${fixture.token}`);
    expect(completeRes.status).toBe(200);

    // 7. Prescription finalized -> PRESCRIPTION_READY (generic message, no medicine/diagnosis leakage)
    const rxRes = await request(app)
      .post('/api/v1/doctor/prescriptions')
      .set('Authorization', `Bearer ${fixture.token}`)
      .send({
        patientId: patient.patientId,
        appointmentId,
        diagnosis: 'Sensitive diagnosis text',
        items: [{ medicineName: 'Sensitive Medicine X', dosage: '500mg', frequency: 'BD', duration: '5 days' }],
      });
    expect(rxRes.status).toBe(201);
    const rxId = rxRes.body.data.prescription.id as string;
    const finalizeRes = await request(app).post(`/api/v1/doctor/prescriptions/${rxId}/finalize`).set('Authorization', `Bearer ${fixture.token}`);
    expect(finalizeRes.status).toBe(200);

    const notifs = await notificationsFor(patient.userId);
    const types = notifs.map((n) => n.type);
    for (const expected of [
      'SECURITY_LOGIN',
      'APPOINTMENT_CONFIRMED',
      'APPOINTMENT_CHECKED_IN',
      'DOCTOR_DELAYED',
      'PATIENT_CALLED',
      'CONSULTATION_STARTED',
      'CONSULTATION_COMPLETED',
      'PRESCRIPTION_READY',
    ]) {
      expect(types).toContain(expected);
    }

    const rxNotif = notifs.find((n) => n.type === 'PRESCRIPTION_READY')!;
    expect(rxNotif.title.toLowerCase()).not.toContain('sensitive medicine');
    expect(rxNotif.message.toLowerCase()).not.toContain('sensitive medicine');
    expect(rxNotif.message.toLowerCase()).not.toContain('diagnosis text');
  }, 30000);

  it('a cancelled appointment sends APPOINTMENT_CANCELLED, and a refunded payment sends PAYMENT_REFUNDED', async () => {
    const { setupPendingPaidAppointment } = await import('../helpers/payment-fixtures.js');
    const { fixture, patient, appointment } = await setupPendingPaidAppointment(app);

    const orderRes = await request(app).post('/api/v1/payments/create-order').set('Authorization', `Bearer ${patient.token}`).send({ appointmentId: appointment.id });
    const order = orderRes.body.data.order as { paymentId: string; providerOrderId: string };
    const simRes = await request(app).post(`/api/v1/payments/${order.paymentId}/simulate`).set('Authorization', `Bearer ${patient.token}`).send({ outcome: 'success' });
    const checkout = simRes.body.data as { providerPaymentId: string; providerSignature: string };
    const verifyRes = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ paymentId: order.paymentId, providerOrderId: order.providerOrderId, providerPaymentId: checkout.providerPaymentId, providerSignature: checkout.providerSignature });
    expect(verifyRes.status).toBe(200);

    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.PAYMENT_REFUND]);
    const refundRes = await request(app).post(`/api/v1/payments/${order.paymentId}/refund`).set('Authorization', `Bearer ${staff.token}`).send({ reason: 'Patient request' });
    expect(refundRes.status).toBe(200);

    const cancelRes = await request(app).post(`/api/v1/appointments/${appointment.id}/cancel`).set('Authorization', `Bearer ${patient.token}`).send({ reason: 'no longer needed' });
    expect(cancelRes.status).toBe(200);

    const notifs = await notificationsFor(patient.userId);
    const types = notifs.map((n) => n.type);
    expect(types).toContain('PAYMENT_REFUNDED');
    expect(types).toContain('APPOINTMENT_CANCELLED');
  });
});
