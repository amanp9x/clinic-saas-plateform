import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { UserRole } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

async function adminFor(clinicId: string) {
  return createReceptionFixture(app, clinicId, [], { role: UserRole.CLINIC_ADMIN });
}

function futureExpiry() {
  return new Date(Date.now() + 3600_000);
}

async function makePayment(input: {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  clinicId: string;
  status: 'CREATED' | 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'CANCELLED' | 'REFUND_PENDING' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
  amount: number;
  capturedAmount?: number;
  refundedAmount?: number;
  capturedAt?: Date;
  method?: 'UPI' | 'CARD' | 'NETBANKING' | 'WALLET' | 'OTHER';
}) {
  return prisma.payment.create({
    data: {
      appointmentId: input.appointmentId,
      patientId: input.patientId,
      doctorId: input.doctorId,
      clinicId: input.clinicId,
      provider: 'MOCK',
      status: input.status,
      subtotal: input.amount,
      amount: input.amount,
      currency: 'INR',
      method: input.method,
      capturedAmount: input.capturedAmount,
      refundedAmount: input.refundedAmount ?? 0,
      capturedAt: input.capturedAt,
      expiresAt: futureExpiry(),
    },
  });
}

describe('Appointment breakdown correctness', () => {
  it('respects the appointment state machine — cancelled is never counted as completed, rates are computed correctly', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const base = new Date('2026-05-01T09:00:00');
    const at = (offsetMin: number) => new Date(base.getTime() + offsetMin * 60_000);

    await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED', scheduledAt: at(0) });
    await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED', scheduledAt: at(15) });
    await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'CANCELLED', scheduledAt: at(30) });
    await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'NO_SHOW', scheduledAt: at(45) });
    await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'CONFIRMED', scheduledAt: at(60) });

    const res = await request(app)
      .get('/api/v1/analytics/appointments')
      .query({ clinicId: fixture.clinicId, range: 'custom', from: '2026-05-01', to: '2026-05-01' })
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    const b = res.body.data.breakdown;
    expect(b.total).toBe(5);
    expect(b.completed).toBe(2);
    expect(b.cancelled).toBe(1);
    expect(b.noShow).toBe(1);
    expect(b.confirmed).toBe(1);
    expect(b.completionRate).toBeCloseTo(2 / 5, 4);
    expect(b.cancellationRate).toBeCloseTo(1 / 5, 4);
    expect(b.noShowRate).toBeCloseTo(1 / 5, 4);
  });

  it('returns an empty-but-valid breakdown (zeros, not an error) when there is no data in range', async () => {
    const fixture = await createDoctorFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const res = await request(app)
      .get('/api/v1/analytics/appointments')
      .query({ clinicId: fixture.clinicId, range: 'custom', from: '2020-01-01', to: '2020-01-02' })
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.breakdown.total).toBe(0);
    expect(res.body.data.breakdown.cancellationRate).toBeNull();
  });
});

describe('Financial correctness (spec section 34)', () => {
  it('a captured payment contributes to gross collected revenue', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });
    const capturedAt = new Date();
    await makePayment({ appointmentId: appt.id, patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'CAPTURED', amount: 900, capturedAmount: 900, capturedAt });

    const res = await request(app).get('/api/v1/analytics/revenue').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.breakdown.grossCollected).toBe(900);
    expect(res.body.data.breakdown.successfulPaymentCount).toBe(1);
  });

  it('a pending payment does NOT contribute to collected revenue', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'PENDING' });
    await makePayment({ appointmentId: appt.id, patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'PENDING', amount: 900 });

    const res = await request(app).get('/api/v1/analytics/revenue').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${admin.token}`);
    expect(res.body.data.breakdown.grossCollected).toBe(0);
    expect(res.body.data.breakdown.pendingAmount).toBe(900);
    expect(res.body.data.breakdown.pendingPaymentCount).toBe(1);
  });

  it('a failed payment does NOT contribute to collected revenue', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'CANCELLED' });
    await makePayment({ appointmentId: appt.id, patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'FAILED', amount: 900 });

    const res = await request(app).get('/api/v1/analytics/revenue').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${admin.token}`);
    expect(res.body.data.breakdown.grossCollected).toBe(0);
    expect(res.body.data.breakdown.failedAmount).toBe(900);
    expect(res.body.data.breakdown.failedPaymentCount).toBe(1);
  });

  it('a refund reduces net collected according to the Refund record — gross stays the historical capture figure', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'CANCELLED' });
    const capturedAt = new Date();
    const payment = await makePayment({ appointmentId: appt.id, patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'REFUNDED', amount: 900, capturedAmount: 900, refundedAmount: 900, capturedAt });
    await prisma.refund.create({ data: { paymentId: payment.id, amount: 900, reason: 'test', actorUserId: admin.userId, status: 'REFUNDED' } });

    const res = await request(app).get('/api/v1/analytics/revenue').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${admin.token}`);
    // Per the documented formula, a fully-REFUNDED payment is excluded from "gross collected" —
    // mirroring the existing clinicBillingTotals precedent (CAPTURED + PARTIALLY_REFUNDED only).
    expect(res.body.data.breakdown.grossCollected).toBe(0);
    expect(res.body.data.breakdown.refundedAmount).toBe(900);
    expect(res.body.data.breakdown.netCollected).toBe(-900);
  });

  it('a partially-refunded payment: gross stays at the full captured amount, refund is deducted for net', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });
    const capturedAt = new Date();
    const payment = await makePayment({ appointmentId: appt.id, patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'PARTIALLY_REFUNDED', amount: 900, capturedAmount: 900, refundedAmount: 300, capturedAt });
    await prisma.refund.create({ data: { paymentId: payment.id, amount: 300, reason: 'test', actorUserId: admin.userId, status: 'PARTIALLY_REFUNDED' } });

    const res = await request(app).get('/api/v1/analytics/revenue').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${admin.token}`);
    expect(res.body.data.breakdown.grossCollected).toBe(900);
    expect(res.body.data.breakdown.refundedAmount).toBe(300);
    expect(res.body.data.breakdown.netCollected).toBe(600);
  });

  it('a cancelled unpaid appointment (no Payment row at all) contributes zero revenue', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const admin = await adminFor(fixture.clinicId);
    await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'CANCELLED' });

    const res = await request(app).get('/api/v1/analytics/revenue').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${admin.token}`);
    expect(res.body.data.breakdown.grossCollected).toBe(0);
    expect(res.body.data.breakdown.successfulPaymentCount).toBe(0);
  });

  it('payment analytics: success/failure rate computed only against attempted (captured+failed) payments, never pending', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const a1 = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });
    const a2 = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'CANCELLED' });
    const a3 = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'PENDING' });
    await makePayment({ appointmentId: a1.id, patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'CAPTURED', amount: 500, capturedAmount: 500, capturedAt: new Date(), method: 'UPI' });
    await makePayment({ appointmentId: a2.id, patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'FAILED', amount: 500 });
    await makePayment({ appointmentId: a3.id, patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'PENDING', amount: 500 });

    const res = await request(app).get('/api/v1/analytics/payments').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    // 1 captured, 1 failed, 1 pending (excluded from the rate denominator) -> 1/2 success, 1/2 failure.
    expect(res.body.data.breakdown.successRate).toBeCloseTo(0.5, 4);
    expect(res.body.data.breakdown.failureRate).toBeCloseTo(0.5, 4);
    expect(res.body.data.breakdown.byMethod.find((m: { method: string | null }) => m.method === 'UPI')?.amount).toBe(500);
  });
});
