import { describe, expect, it } from 'vitest';
import request from 'supertest';

const { createApp } = await import('../../src/app.js');
const { createPatientFixture } = await import('../helpers/doctor-fixtures.js');
const { notifyUser } = await import('../../src/modules/notifications/notification-dispatch.service.js');
const { mockEmailOutbox, clearMockEmailOutbox } = await import('../../src/modules/notifications/email/mock-email-provider.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

describe('GET /api/v1/notification-preferences', () => {
  it('returns all-on defaults for a user with no saved preferences', async () => {
    const patient = await createPatientFixture(app);
    const res = await request(app).get('/api/v1/notification-preferences').set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.preferences.appointmentEmail).toBe(true);
    expect(res.body.data.preferences.appointmentInApp).toBe(true);
    expect(res.body.data.preferences.queueEmail).toBe(false); // schema default
  });
});

describe('PATCH /api/v1/notification-preferences', () => {
  it('persists the updated preferences', async () => {
    const patient = await createPatientFixture(app);
    const res = await request(app)
      .patch('/api/v1/notification-preferences')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({
        appointmentEmail: false,
        appointmentInApp: true,
        paymentEmail: true,
        paymentInApp: true,
        queueEmail: false,
        queueInApp: true,
        prescriptionEmail: false,
        prescriptionInApp: true,
        announcementEmail: false,
        announcementInApp: false,
      });
    expect(res.status).toBe(200);
    expect(res.body.data.preferences.appointmentEmail).toBe(false);

    const refetch = await request(app).get('/api/v1/notification-preferences').set('Authorization', `Bearer ${patient.token}`);
    expect(refetch.body.data.preferences.appointmentEmail).toBe(false);
    expect(refetch.body.data.preferences.announcementEmail).toBe(false);
  });

  it('two simultaneous preference updates converge on one consistent final state, not a torn write', async () => {
    const patient = await createPatientFixture(app);
    const base = {
      appointmentEmail: true,
      appointmentInApp: true,
      paymentEmail: true,
      paymentInApp: true,
      queueEmail: false,
      queueInApp: true,
      prescriptionEmail: true,
      prescriptionInApp: true,
      announcementEmail: true,
      announcementInApp: true,
    };
    const updateA = { ...base, appointmentEmail: false, paymentEmail: false };
    const updateB = { ...base, appointmentEmail: true, paymentEmail: true, queueInApp: false };

    const [resA, resB] = await Promise.all([
      request(app).patch('/api/v1/notification-preferences').set('Authorization', `Bearer ${patient.token}`).send(updateA),
      request(app).patch('/api/v1/notification-preferences').set('Authorization', `Bearer ${patient.token}`).send(updateB),
    ]);
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    const final = await prisma.notificationPreference.findUniqueOrThrow({ where: { userId: patient.userId } });
    // Whichever request landed last, its own fields are internally consistent (not a mix of
    // updateA's appointmentEmail with updateB's queueInApp from two half-applied writes).
    const matchesA = final.appointmentEmail === updateA.appointmentEmail && final.paymentEmail === updateA.paymentEmail && final.queueInApp === updateA.queueInApp;
    const matchesB = final.appointmentEmail === updateB.appointmentEmail && final.paymentEmail === updateB.paymentEmail && final.queueInApp === updateB.queueInApp;
    expect(matchesA || matchesB).toBe(true);

    const onlyOnePrefRow = await prisma.notificationPreference.count({ where: { userId: patient.userId } });
    expect(onlyOnePrefRow).toBe(1);
  });
});

describe('Transactional/security notifications bypass preferences', () => {
  it('an OPTIONAL-tier email is suppressed when the category is turned off, but SECURITY/TRANSACTIONAL still deliver', async () => {
    const patient = await createPatientFixture(app);
    await request(app)
      .patch('/api/v1/notification-preferences')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({
        appointmentEmail: false,
        appointmentInApp: true,
        paymentEmail: false,
        paymentInApp: true,
        queueEmail: false,
        queueInApp: true,
        prescriptionEmail: false,
        prescriptionInApp: true,
        announcementEmail: false,
        announcementInApp: true,
      });

    clearMockEmailOutbox();

    // REPORT_READY is OPTIONAL/prescription-category — should be suppressed since prescriptionEmail is off.
    await notifyUser({
      userId: patient.userId,
      type: 'REPORT_READY',
      title: 'Report ready (optional)',
      message: 'Optional-tier test',
      notificationKey: `test:optional:${patient.userId}`,
      email: { subject: 'Optional', html: '<p>x</p>', text: 'x' },
    });
    expect(mockEmailOutbox.some((m) => m.subject === 'Optional')).toBe(false);

    // SECURITY_LOGIN is SECURITY-tier — must never be suppressed by preference.
    await notifyUser({
      userId: patient.userId,
      type: 'SECURITY_LOGIN',
      title: 'Security (bypass)',
      message: 'Security-tier test',
      notificationKey: `test:security:${patient.userId}`,
      email: { subject: 'SecurityBypass', html: '<p>x</p>', text: 'x' },
    });
    expect(mockEmailOutbox.some((m) => m.subject === 'SecurityBypass')).toBe(true);
  });
});
