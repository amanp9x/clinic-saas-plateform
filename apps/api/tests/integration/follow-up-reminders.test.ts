import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { UserRole } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture, completeConsultationFixture } = await import(
  '../helpers/doctor-fixtures.js'
);
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');
const { processDueFollowUpReminders } = await import('../../src/modules/notifications/reminder.service.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

async function setupDueConsultation(followUpDate: Date) {
  const fixture = await createDoctorFixture(app);
  const patient = await createPatientFixture(app);
  const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'CONFIRMED' });
  const consultation = await completeConsultationFixture(app, { doctorToken: fixture.token, appointmentId: appt.id, followUpDate: '2027-01-01' });
  // Direct backdate for exact time control — same deterministic-substitute-for-real-elapsed-time
  // idiom already used for SlotHold expiry (Phase 8) and waitlist notification tests (Phase 13).
  await prisma.consultation.update({ where: { id: consultation.id }, data: { followUpDate } });
  return { fixture, patient, appt, consultationId: consultation.id };
}

describe('Follow-up reminder scheduler', () => {
  it('sends a reminder for a follow-up that just became due, and never sends it twice', async () => {
    const { patient, consultationId } = await setupDueConsultation(new Date(Date.now() - 5 * 60_000));

    const first = await processDueFollowUpReminders();
    expect(first.processed).toBeGreaterThanOrEqual(1);

    const notif = await prisma.notification.findUnique({ where: { notificationKey: `followup:${consultationId}:reminder` } });
    expect(notif).not.toBeNull();
    expect(notif!.type).toBe('FOLLOW_UP_DUE');
    expect(notif!.userId).toBe(patient.userId);

    await processDueFollowUpReminders();
    await processDueFollowUpReminders();
    const count = await prisma.notification.count({ where: { notificationKey: `followup:${consultationId}:reminder` } });
    expect(count).toBe(1);
  });

  it('does not fire for a follow-up date more than 24h in the past (avoids flooding on old historical data)', async () => {
    const { consultationId } = await setupDueConsultation(new Date(Date.now() - 3 * 24 * 60 * 60_000));

    await processDueFollowUpReminders();
    const notif = await prisma.notification.findUnique({ where: { notificationKey: `followup:${consultationId}:reminder` } });
    expect(notif).toBeNull();
  });

  it('does not fire for a follow-up date that is not due yet', async () => {
    const { consultationId } = await setupDueConsultation(new Date(Date.now() + 5 * 24 * 60 * 60_000));

    await processDueFollowUpReminders();
    const notif = await prisma.notification.findUnique({ where: { notificationKey: `followup:${consultationId}:reminder` } });
    expect(notif).toBeNull();
  });

  it('the actionUrl deep-links into the existing booking flow for the same doctor+clinic', async () => {
    const { fixture, consultationId } = await setupDueConsultation(new Date(Date.now() - 60_000));
    await processDueFollowUpReminders();

    const notif = await prisma.notification.findUnique({ where: { notificationKey: `followup:${consultationId}:reminder` } });
    expect(notif!.actionUrl).toContain(`doctorId=${fixture.doctorId}`);
    expect(notif!.actionUrl).toContain(`clinicId=${fixture.clinicId}`);
  });
});

describe('MANDATORY: simultaneous reminder-scheduler ticks never double-notify', () => {
  it('two concurrent processDueFollowUpReminders calls for the same due consultation produce exactly one notification', async () => {
    const { consultationId } = await setupDueConsultation(new Date(Date.now() - 60_000));

    await Promise.all([processDueFollowUpReminders(), processDueFollowUpReminders()]);

    const count = await prisma.notification.count({ where: { notificationKey: `followup:${consultationId}:reminder` } });
    expect(count).toBe(1);
  });
});

describe('Analytics integration (Phase 11 extension)', () => {
  it('the clinic analytics overview reflects completed consultations that recommended a follow-up', async () => {
    const fixture = await createDoctorFixture(app);
    const admin = await createReceptionFixture(app, fixture.clinicId, [], { role: UserRole.CLINIC_ADMIN });
    const patient = await createPatientFixture(app);

    const before = await request(app).get('/api/v1/analytics/overview').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${admin.token}`);
    const baseline = before.body.data.followUps.totalDue as number;

    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'CONFIRMED' });
    await completeConsultationFixture(app, { doctorToken: fixture.token, appointmentId: appt.id, followUpDate: '2027-01-01' });

    const after = await request(app).get('/api/v1/analytics/overview').query({ clinicId: fixture.clinicId, range: 'today' }).set('Authorization', `Bearer ${admin.token}`);
    expect(after.body.data.followUps.totalDue).toBe(baseline + 1);
  });
});
