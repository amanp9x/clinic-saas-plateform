import type { Express } from 'express';
import request from 'supertest';
import { prisma } from '../../src/config/database.js';
import {
  createClinicWorkingHoursFixture,
  createDoctorAvailabilityFixture,
  createDoctorFixture,
  createPatientFixture,
  tomorrowInfo,
  atTime,
} from './doctor-fixtures.js';

/** Opts a clinic into the Phase 9 online-payment-gated booking flow — every other clinic in the
 * test suite (including every Phase 8 fixture) defaults to `onlinePaymentRequired: false`, so
 * this is the one explicit switch that turns PENDING-until-paid appointments on for a test. */
export async function enableOnlinePayment(
  clinicId: string,
  overrides: { taxPercent?: number; serviceFeeFlat?: number; refundOnCancellationPercent?: number } = {},
) {
  return prisma.clinicSettings.upsert({
    where: { clinicId },
    create: {
      clinicId,
      onlinePaymentRequired: true,
      taxPercent: overrides.taxPercent,
      serviceFeeFlat: overrides.serviceFeeFlat,
      refundOnCancellationPercent: overrides.refundOnCancellationPercent ?? 100,
    },
    update: {
      onlinePaymentRequired: true,
      taxPercent: overrides.taxPercent,
      serviceFeeFlat: overrides.serviceFeeFlat,
      refundOnCancellationPercent: overrides.refundOnCancellationPercent ?? 100,
    },
  });
}

/** Full setup for a payment-gated booking scenario: a bookable doctor+clinic with online payment
 * required, plus a patient with a fresh PENDING appointment (not yet paid). */
export async function setupPendingPaidAppointment(app: Express, opts: { taxPercent?: number; serviceFeeFlat?: number; refundOnCancellationPercent?: number } = {}) {
  const fixture = await createDoctorFixture(app);
  await enableOnlinePayment(fixture.clinicId, opts);
  const { weekday, dateObj } = tomorrowInfo();
  await createClinicWorkingHoursFixture(fixture.clinicId, { weekday, sessions: [{ startTime: '09:00', endTime: '13:00' }] });
  await createDoctorAvailabilityFixture(fixture.clinicDoctorId, { weekday, startTime: '09:00', endTime: '13:00', consultationDurationMinutes: 15 });
  const slot = atTime(dateObj, '09:00');

  const patient = await createPatientFixture(app);
  const bookRes = await request(app)
    .post('/api/v1/appointments')
    .set('Authorization', `Bearer ${patient.token}`)
    .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC', appointmentType: 'NEW_CONSULTATION' });
  if (bookRes.status !== 201) {
    throw new Error(`Payment fixture booking failed: ${JSON.stringify(bookRes.body)}`);
  }

  return { fixture, patient, appointment: bookRes.body.data.appointment as { id: string; status: string; bookingReference: string } };
}
