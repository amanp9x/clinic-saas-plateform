import { describe, expect, it, beforeEach } from 'vitest';

const { createApp } = await import('../../src/app.js');
const { createPatientFixture } = await import('../helpers/doctor-fixtures.js');
const { notifyUser } = await import('../../src/modules/notifications/notification-dispatch.service.js');
const { mockEmailOutbox, clearMockEmailOutbox } = await import('../../src/modules/notifications/email/mock-email-provider.js');
const { appointmentConfirmedEmail } = await import('../../src/modules/notifications/email/templates.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();
void app;

beforeEach(() => {
  clearMockEmailOutbox();
});

describe('Notification idempotency', () => {
  it('a duplicate notificationKey never creates a second notification (sequential)', async () => {
    const patient = await createPatientFixture(app);
    const key = `test:dup-seq:${patient.userId}`;
    await notifyUser({ userId: patient.userId, type: 'SYSTEM', title: 'A', message: 'first', notificationKey: key });
    await notifyUser({ userId: patient.userId, type: 'SYSTEM', title: 'B', message: 'second — should be ignored', notificationKey: key });

    const count = await prisma.notification.count({ where: { notificationKey: key } });
    expect(count).toBe(1);
    const row = await prisma.notification.findUniqueOrThrow({ where: { notificationKey: key } });
    expect(row.title).toBe('A'); // the first write wins; the duplicate call was a no-op
  });
});

describe('MANDATORY: same event processed simultaneously', () => {
  it('produces exactly one logical notification and exactly one email delivery record', async () => {
    const patient = await createPatientFixture(app);
    const key = `test:dup-concurrent:${patient.userId}`;

    await Promise.all([
      notifyUser({ userId: patient.userId, type: 'PAYMENT_SUCCESS', title: 'Payment received', message: 'x', notificationKey: key, email: { subject: 'Concurrent', html: '<p>x</p>', text: 'x' } }),
      notifyUser({ userId: patient.userId, type: 'PAYMENT_SUCCESS', title: 'Payment received', message: 'x', notificationKey: key, email: { subject: 'Concurrent', html: '<p>x</p>', text: 'x' } }),
    ]);

    const notifCount = await prisma.notification.count({ where: { notificationKey: key } });
    expect(notifCount).toBe(1);

    const notif = await prisma.notification.findUniqueOrThrow({ where: { notificationKey: key } });
    const deliveryCount = await prisma.notificationDelivery.count({ where: { notificationId: notif.id } });
    expect(deliveryCount).toBe(1);
  });
});

describe('Email templates', () => {
  it('render subject/recipient-safe content with no sensitive data', () => {
    const email = appointmentConfirmedEmail({
      clinicName: 'Sunrise Clinic',
      doctorName: 'Dr. Test',
      patientName: 'Test Patient',
      bookingReference: 'APT-TEST-1',
      scheduledAt: new Date('2026-08-20T09:00:00Z'),
      actionUrl: 'http://localhost:3000/appointments/123',
    });
    expect(email.subject).toContain('APT-TEST-1');
    expect(email.subject.toLowerCase()).not.toContain('diagnosis');
    expect(email.html).toContain('Sunrise Clinic');
    expect(email.html).toContain('Dr. Test');
    expect(email.text).toContain('APT-TEST-1');
  });
});

describe('Mock email provider + delivery tracking', () => {
  it('delivers successfully and records a SENT delivery with the correct recipient/subject', async () => {
    const patient = await createPatientFixture(app);
    await notifyUser({
      userId: patient.userId,
      type: 'SYSTEM',
      title: 'Email delivery test',
      message: 'x',
      notificationKey: `test:email-success:${patient.userId}`,
      email: { subject: 'Delivery test subject', html: '<p>hi</p>', text: 'hi' },
    });

    expect(mockEmailOutbox.some((m) => m.subject === 'Delivery test subject')).toBe(true);
    const notif = await prisma.notification.findUniqueOrThrow({ where: { notificationKey: `test:email-success:${patient.userId}` } });
    const delivery = await prisma.notificationDelivery.findFirstOrThrow({ where: { notificationId: notif.id } });
    expect(delivery.status).toBe('SENT');
    expect(delivery.attempts).toBe(1);
    expect(delivery.sentAt).not.toBeNull();
    expect(delivery.providerMessageId).toBeTruthy();
  });

  it('retries a failing delivery up to the bounded maximum and records FAILED with attempts=3', async () => {
    const user = await prisma.user.create({ data: { email: 'retry-target+forcefail@example.com', role: 'PATIENT', isEmailVerified: true, isActive: true, patientProfile: { create: { fullName: 'Retry Target' } } } });
    await notifyUser({
      userId: user.id,
      type: 'SYSTEM',
      title: 'Retry test',
      message: 'x',
      notificationKey: `test:email-retry:${user.id}`,
      email: { subject: 'Retry test subject', html: '<p>x</p>', text: 'x' },
    });

    const notif = await prisma.notification.findUniqueOrThrow({ where: { notificationKey: `test:email-retry:${user.id}` } });
    const delivery = await prisma.notificationDelivery.findFirstOrThrow({ where: { notificationId: notif.id } });
    expect(delivery.status).toBe('FAILED');
    expect(delivery.attempts).toBe(3);
    expect(delivery.failureReason).toBeTruthy();

    // The in-app notification itself must survive regardless of email failure.
    expect(notif.title).toBe('Retry test');
  });

  it('never sends an email for a user with no email on file (phone-only account)', async () => {
    const user = await prisma.user.create({ data: { phone: '+919876500999', role: 'PATIENT', isMobileVerified: true, isActive: true, patientProfile: { create: { fullName: 'Phone Only' } } } });
    await notifyUser({
      userId: user.id,
      type: 'SYSTEM',
      title: 'No email test',
      message: 'x',
      notificationKey: `test:no-email:${user.id}`,
      email: { subject: 'Should never send', html: '<p>x</p>', text: 'x' },
    });
    expect(mockEmailOutbox.some((m) => m.subject === 'Should never send')).toBe(false);
    const notif = await prisma.notification.findUniqueOrThrow({ where: { notificationKey: `test:no-email:${user.id}` } });
    const deliveryCount = await prisma.notificationDelivery.count({ where: { notificationId: notif.id } });
    expect(deliveryCount).toBe(0);
  });
});
