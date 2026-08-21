import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { UserRole } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture, createPlatformAdminFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

// This file's tests each create 2+ doctor fixtures (bcrypt hash + login) plus multiple HTTP round
// trips, well above the suite average — under full-regression system load the default 5000ms
// vitest timeout has been observed to trip here even though nothing is actually wrong (matches the
// documented full-suite-only timing-flakiness pattern already seen in this codebase). Every test
// gets a longer explicit budget, the same established remedy `e2e-notification-smoke.test.ts`
// already uses.
const TEST_TIMEOUT = 20000;

function futureDate(daysAhead = 2) {
  return new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
}

let patient: Awaited<ReturnType<typeof createPatientFixture>>;

beforeAll(async () => {
  patient = await createPatientFixture(app);
});

/** A clinic with 2 doctors (the fixture's own doctor, plus a second doctor associated in) — the
 * cascade must cover every doctor at the clinic, not just one, so every scenario needs at least 2. */
async function setupClinicWithTwoDoctors() {
  const fixture = await createDoctorFixture(app);
  const clinicAdmin = await createReceptionFixture(app, fixture.clinicId, [], { role: UserRole.CLINIC_ADMIN });
  const secondDoctor = await createDoctorFixture(app);
  await request(app)
    .post('/api/v1/clinic/doctors')
    .set('Authorization', `Bearer ${clinicAdmin.token}`)
    .send({ clinicId: fixture.clinicId, doctorId: secondDoctor.doctorId, consultationTypes: ['IN_CLINIC'] });
  return { fixture, clinicAdmin, secondDoctor };
}

describe('Clinic operating-status change — cascade (PATCH /api/v1/clinic/status)', () => {
  it(
    'requires authentication',
    async () => {
      const res = await request(app).patch('/api/v1/clinic/status').send({ clinicId: randomUUID(), status: 'SUSPENDED' });
      expect(res.status).toBe(401);
    },
    TEST_TIMEOUT,
  );

  it(
    'rejects a receptionist without CLINIC_UPDATE permission',
    async () => {
      const { fixture } = await setupClinicWithTwoDoctors();
      const noPerm = await createReceptionFixture(app, fixture.clinicId, [], { role: UserRole.RECEPTIONIST });
      const res = await request(app)
        .patch('/api/v1/clinic/status')
        .set('Authorization', `Bearer ${noPerm.token}`)
        .send({ clinicId: fixture.clinicId, status: 'SUSPENDED' });
      expect(res.status).toBe(403);
    },
    TEST_TIMEOUT,
  );

  it(
    'rejects an invalid status value',
    async () => {
      const { fixture, clinicAdmin } = await setupClinicWithTwoDoctors();
      const res = await request(app)
        .patch('/api/v1/clinic/status')
        .set('Authorization', `Bearer ${clinicAdmin.token}`)
        .send({ clinicId: fixture.clinicId, status: 'NOT_A_REAL_STATUS' });
      expect(res.status).toBe(400);
    },
    TEST_TIMEOUT,
  );

  it(
    'requires a reason to temporarily close',
    async () => {
      const { fixture, clinicAdmin } = await setupClinicWithTwoDoctors();
      const res = await request(app)
        .patch('/api/v1/clinic/status')
        .set('Authorization', `Bearer ${clinicAdmin.token}`)
        .send({ clinicId: fixture.clinicId, status: 'TEMPORARILY_CLOSED' });
      expect(res.status).toBe(400);
    },
    TEST_TIMEOUT,
  );

  it(
    'suspending the clinic cancels future PENDING/CONFIRMED appointments across every doctor at the clinic, notifies patients, and leaves other-status and other-clinic appointments untouched',
    async () => {
      const { fixture, clinicAdmin, secondDoctor } = await setupClinicWithTwoDoctors();

      const confirmedDoctorA = await createAppointmentFixture({
        patientId: patient.patientId,
        doctorId: fixture.doctorId,
        clinicId: fixture.clinicId,
        status: 'CONFIRMED',
        scheduledAt: futureDate(2),
      });
      const pendingDoctorB = await createAppointmentFixture({
        patientId: patient.patientId,
        doctorId: secondDoctor.doctorId,
        clinicId: fixture.clinicId,
        status: 'PENDING',
        scheduledAt: futureDate(3),
      });
      const alreadyCancelled = await createAppointmentFixture({
        patientId: patient.patientId,
        doctorId: fixture.doctorId,
        clinicId: fixture.clinicId,
        status: 'CANCELLED',
        scheduledAt: futureDate(4),
      });
      const completedPast = await createAppointmentFixture({
        patientId: patient.patientId,
        doctorId: fixture.doctorId,
        clinicId: fixture.clinicId,
        status: 'COMPLETED',
        scheduledAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });
      const otherClinic = await createDoctorFixture(app);
      const elsewhere = await createAppointmentFixture({
        patientId: patient.patientId,
        doctorId: otherClinic.doctorId,
        clinicId: otherClinic.clinicId,
        status: 'CONFIRMED',
        scheduledAt: futureDate(2),
      });

      const res = await request(app)
        .patch('/api/v1/clinic/status')
        .set('Authorization', `Bearer ${clinicAdmin.token}`)
        .send({ clinicId: fixture.clinicId, status: 'SUSPENDED', reason: 'Compliance review' });
      expect(res.status).toBe(200);
      expect(res.body.data.clinic.status).toBe('SUSPENDED');
      expect(res.body.data.cancelledAppointmentCount).toBe(2);

      const rowA = await prisma.appointment.findUniqueOrThrow({ where: { id: confirmedDoctorA.id } });
      expect(rowA.status).toBe('CANCELLED');
      expect(rowA.cancelReason).toBe('Compliance review');

      const rowB = await prisma.appointment.findUniqueOrThrow({ where: { id: pendingDoctorB.id } });
      expect(rowB.status).toBe('CANCELLED');

      const rowCancelled = await prisma.appointment.findUniqueOrThrow({ where: { id: alreadyCancelled.id } });
      expect(rowCancelled.cancelReason).toBeNull();

      const rowCompleted = await prisma.appointment.findUniqueOrThrow({ where: { id: completedPast.id } });
      expect(rowCompleted.status).toBe('COMPLETED');

      const rowElsewhere = await prisma.appointment.findUniqueOrThrow({ where: { id: elsewhere.id } });
      expect(rowElsewhere.status).toBe('CONFIRMED');

      const notifA = await prisma.notification.findUnique({ where: { notificationKey: `appointment:${confirmedDoctorA.id}:cancelled` } });
      expect(notifA).not.toBeNull();
      const notifB = await prisma.notification.findUnique({ where: { notificationKey: `appointment:${pendingDoctorB.id}:cancelled` } });
      expect(notifB).not.toBeNull();

      const statusAudit = await prisma.auditLog.findFirst({ where: { entityType: 'Clinic', entityId: fixture.clinicId, action: 'clinic.status_updated' } });
      expect((statusAudit!.metadata as { cancelledAppointmentCount: number }).cancelledAppointmentCount).toBe(2);
    },
    TEST_TIMEOUT,
  );

  it(
    'reactivating to OPEN does not cancel anything',
    async () => {
      const { fixture, clinicAdmin } = await setupClinicWithTwoDoctors();
      const appt = await createAppointmentFixture({
        patientId: patient.patientId,
        doctorId: fixture.doctorId,
        clinicId: fixture.clinicId,
        status: 'CONFIRMED',
        scheduledAt: futureDate(2),
      });

      const res = await request(app)
        .patch('/api/v1/clinic/status')
        .set('Authorization', `Bearer ${clinicAdmin.token}`)
        .send({ clinicId: fixture.clinicId, status: 'OPEN' });
      expect(res.status).toBe(200);
      expect(res.body.data.cancelledAppointmentCount).toBe(0);

      const row = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
      expect(row.status).toBe('CONFIRMED');
    },
    TEST_TIMEOUT,
  );

  it(
    'a duplicate suspend call is idempotent — no double notification',
    async () => {
      const { fixture, clinicAdmin } = await setupClinicWithTwoDoctors();
      const appt = await createAppointmentFixture({
        patientId: patient.patientId,
        doctorId: fixture.doctorId,
        clinicId: fixture.clinicId,
        status: 'CONFIRMED',
        scheduledAt: futureDate(2),
      });

      const first = await request(app).patch('/api/v1/clinic/status').set('Authorization', `Bearer ${clinicAdmin.token}`).send({ clinicId: fixture.clinicId, status: 'SUSPENDED' });
      expect(first.body.data.cancelledAppointmentCount).toBe(1);

      const second = await request(app).patch('/api/v1/clinic/status').set('Authorization', `Bearer ${clinicAdmin.token}`).send({ clinicId: fixture.clinicId, status: 'SUSPENDED' });
      expect(second.status).toBe(200);
      expect(second.body.data.cancelledAppointmentCount).toBe(0);

      const notifCount = await prisma.notification.count({ where: { notificationKey: `appointment:${appt.id}:cancelled` } });
      expect(notifCount).toBe(1);
    },
    TEST_TIMEOUT,
  );

  it(
    'blocks new bookings while the clinic is non-OPEN — availability reports CLINIC_SUSPENDED and a hold attempt fails',
    async () => {
      const { fixture, clinicAdmin } = await setupClinicWithTwoDoctors();
      await request(app).patch('/api/v1/clinic/status').set('Authorization', `Bearer ${clinicAdmin.token}`).send({ clinicId: fixture.clinicId, status: 'CLOSED' });

      const dateStr = futureDate(2).toISOString().slice(0, 10);
      const availRes = await request(app).get(`/api/v1/appointments/availability?doctorId=${fixture.doctorId}&clinicId=${fixture.clinicId}&date=${dateStr}`);
      expect(availRes.status).toBe(200);
      expect(availRes.body.data.closedReason).toBe('CLINIC_SUSPENDED');
      expect(availRes.body.data.slots).toEqual([]);

      const holdRes = await request(app)
        .post('/api/v1/appointments/hold')
        .set('Authorization', `Bearer ${patient.token}`)
        .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: futureDate(2).toISOString(), consultationType: 'IN_CLINIC' });
      expect(holdRes.status).toBe(409);
    },
    TEST_TIMEOUT,
  );

  it(
    'a self-service SUSPENDED clinic disappears from public search, but a CLOSED/TEMPORARILY_CLOSED one stays visible',
    async () => {
      const { fixture, clinicAdmin } = await setupClinicWithTwoDoctors();
      const clinicName = (await prisma.clinic.findUniqueOrThrow({ where: { id: fixture.clinicId } })).name;

      await request(app)
        .patch('/api/v1/clinic/status')
        .set('Authorization', `Bearer ${clinicAdmin.token}`)
        .send({ clinicId: fixture.clinicId, status: 'TEMPORARILY_CLOSED', reason: 'Renovation' });
      const duringClosed = await request(app).get(`/api/v1/catalog/clinics?query=${encodeURIComponent(clinicName)}`);
      expect(duringClosed.body.data.items.some((c: { id: string }) => c.id === fixture.clinicId)).toBe(true);

      await request(app).patch('/api/v1/clinic/status').set('Authorization', `Bearer ${clinicAdmin.token}`).send({ clinicId: fixture.clinicId, status: 'SUSPENDED' });
      const duringSuspended = await request(app).get(`/api/v1/catalog/clinics?query=${encodeURIComponent(clinicName)}`);
      expect(duringSuspended.body.data.items.some((c: { id: string }) => c.id === fixture.clinicId)).toBe(false);
    },
    TEST_TIMEOUT,
  );
});

/** A clinic must be VERIFIED before it can be moved to SUSPENDED (`ALLOWED_TRANSITIONS` only
 * permits VERIFIED -> SUSPENDED) — drives the exact same PENDING -> SUBMITTED -> UNDER_REVIEW ->
 * VERIFIED lifecycle `platform-admin-verification.test.ts` already exercises. */
async function verifyClinic(clinicId: string, clinicAdminToken: string, adminToken: string) {
  await request(app).post('/api/v1/clinic/verification').set('Authorization', `Bearer ${clinicAdminToken}`).send({ clinicId, notes: 'All documents attached' });
  await request(app).patch(`/api/v1/platform-admin/clinics/${clinicId}/verification`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'UNDER_REVIEW' });
  await request(app).patch(`/api/v1/platform-admin/clinics/${clinicId}/verification`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'VERIFIED' });
}

describe('Platform-admin verification suspension — cascade', () => {
  it(
    'suspending a clinic cancels its future appointments across every doctor',
    async () => {
      const admin = await createPlatformAdminFixture(app);
      const { fixture, clinicAdmin, secondDoctor } = await setupClinicWithTwoDoctors();
      await verifyClinic(fixture.clinicId, clinicAdmin.token, admin.token);

      const apptA = await createAppointmentFixture({
        patientId: patient.patientId,
        doctorId: fixture.doctorId,
        clinicId: fixture.clinicId,
        status: 'CONFIRMED',
        scheduledAt: futureDate(2),
      });
      const apptB = await createAppointmentFixture({
        patientId: patient.patientId,
        doctorId: secondDoctor.doctorId,
        clinicId: fixture.clinicId,
        status: 'PENDING',
        scheduledAt: futureDate(3),
      });

      const res = await request(app)
        .patch(`/api/v1/platform-admin/clinics/${fixture.clinicId}/verification`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'SUSPENDED', notes: 'Fraud investigation' });
      expect(res.status).toBe(200);
      expect(res.body.data.cancelledAppointmentCount).toBe(2);

      const rowA = await prisma.appointment.findUniqueOrThrow({ where: { id: apptA.id } });
      expect(rowA.status).toBe('CANCELLED');
      expect(rowA.cancelReason).toBe('Fraud investigation');
      const rowB = await prisma.appointment.findUniqueOrThrow({ where: { id: apptB.id } });
      expect(rowB.status).toBe('CANCELLED');

      // verifyClinic() above also produced UNDER_REVIEW/VERIFIED audit rows for this same action —
      // the SUSPENDED transition's row (with the real cancelledAppointmentCount) is the most recent.
      const verificationAudit = await prisma.auditLog.findFirst({
        where: { entityType: 'Clinic', entityId: fixture.clinicId, action: 'platform.clinic_verification_updated' },
        orderBy: { createdAt: 'desc' },
      });
      expect((verificationAudit!.metadata as { cancelledAppointmentCount: number }).cancelledAppointmentCount).toBe(2);
    },
    TEST_TIMEOUT,
  );

  it(
    'a suspended clinic disappears from public search and reappears once reinstated',
    async () => {
      const admin = await createPlatformAdminFixture(app);
      const { fixture, clinicAdmin } = await setupClinicWithTwoDoctors();
      await verifyClinic(fixture.clinicId, clinicAdmin.token, admin.token);
      const clinicName = (await prisma.clinic.findUniqueOrThrow({ where: { id: fixture.clinicId } })).name;

      const beforeRes = await request(app).get(`/api/v1/catalog/clinics?query=${encodeURIComponent(clinicName)}`);
      expect(beforeRes.body.data.items.some((c: { id: string }) => c.id === fixture.clinicId)).toBe(true);

      await request(app)
        .patch(`/api/v1/platform-admin/clinics/${fixture.clinicId}/verification`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'SUSPENDED', notes: 'Fraud investigation' });

      const duringRes = await request(app).get(`/api/v1/catalog/clinics?query=${encodeURIComponent(clinicName)}`);
      expect(duringRes.body.data.items.some((c: { id: string }) => c.id === fixture.clinicId)).toBe(false);

      await request(app)
        .patch(`/api/v1/platform-admin/clinics/${fixture.clinicId}/verification`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'VERIFIED' });

      const afterRes = await request(app).get(`/api/v1/catalog/clinics?query=${encodeURIComponent(clinicName)}`);
      expect(afterRes.body.data.items.some((c: { id: string }) => c.id === fixture.clinicId)).toBe(true);
    },
    TEST_TIMEOUT,
  );

  it(
    'blocks new bookings while verification status is SUSPENDED',
    async () => {
      const admin = await createPlatformAdminFixture(app);
      const { fixture, clinicAdmin } = await setupClinicWithTwoDoctors();
      await verifyClinic(fixture.clinicId, clinicAdmin.token, admin.token);
      await request(app)
        .patch(`/api/v1/platform-admin/clinics/${fixture.clinicId}/verification`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'SUSPENDED', notes: 'Fraud investigation' });

      const dateStr = futureDate(2).toISOString().slice(0, 10);
      const availRes = await request(app).get(`/api/v1/appointments/availability?doctorId=${fixture.doctorId}&clinicId=${fixture.clinicId}&date=${dateStr}`);
      expect(availRes.status).toBe(200);
      expect(availRes.body.data.closedReason).toBe('CLINIC_SUSPENDED');
    },
    TEST_TIMEOUT,
  );
});

describe('MANDATORY: concurrent clinic suspensions never double-cancel or double-notify', () => {
  it(
    'two concurrent suspend requests for the same clinic cancel each conflicting appointment exactly once',
    async () => {
      const { fixture, clinicAdmin } = await setupClinicWithTwoDoctors();
      const appt = await createAppointmentFixture({
        patientId: patient.patientId,
        doctorId: fixture.doctorId,
        clinicId: fixture.clinicId,
        status: 'CONFIRMED',
        scheduledAt: futureDate(2),
      });

      const [resA, resB] = await Promise.all([
        request(app).patch('/api/v1/clinic/status').set('Authorization', `Bearer ${clinicAdmin.token}`).send({ clinicId: fixture.clinicId, status: 'SUSPENDED' }),
        request(app).patch('/api/v1/clinic/status').set('Authorization', `Bearer ${clinicAdmin.token}`).send({ clinicId: fixture.clinicId, status: 'SUSPENDED' }),
      ]);

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);

      const totalClaimed = resA.body.data.cancelledAppointmentCount + resB.body.data.cancelledAppointmentCount;
      expect(totalClaimed).toBe(1);

      const row = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
      expect(row.status).toBe('CANCELLED');

      const notifCount = await prisma.notification.count({ where: { notificationKey: `appointment:${appt.id}:cancelled` } });
      expect(notifCount).toBe(1);

      const appointmentAudits = await prisma.auditLog.count({ where: { entityType: 'Appointment', entityId: appt.id, action: 'appointment.cancelled' } });
      expect(appointmentAudits).toBe(1);
    },
    TEST_TIMEOUT,
  );
});
