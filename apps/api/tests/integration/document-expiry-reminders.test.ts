import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { UserRole } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');
const { processDueDocumentExpiryReminders } = await import('../../src/modules/notifications/reminder.service.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

async function setupDocumentDueIn(days: number) {
  const fixture = await createDoctorFixture(app);
  const clinicAdmin = await createReceptionFixture(app, fixture.clinicId, [], { role: UserRole.CLINIC_ADMIN });

  const expiryDate = new Date(Date.now() + days * 24 * 60 * 60_000).toISOString().slice(0, 10);
  const res = await request(app)
    .post('/api/v1/clinic/documents')
    .set('Authorization', `Bearer ${clinicAdmin.token}`)
    .field('clinicId', fixture.clinicId)
    .field('type', 'LICENSE')
    .field('expiryDate', expiryDate)
    .attach('file', Buffer.from('%PDF-1.4 fake license'), { filename: 'license.pdf', contentType: 'application/pdf' });
  expect(res.status).toBe(201);

  return { fixture, clinicAdmin, documentId: res.body.data.document.id as string };
}

describe('Document expiry reminder scheduler', () => {
  it('sends a 30-day-tier reminder for a document expiring in 25 days, and never sends it twice', async () => {
    const { clinicAdmin, documentId } = await setupDocumentDueIn(25);

    const first = await processDueDocumentExpiryReminders();
    expect(first.processed).toBeGreaterThanOrEqual(1);

    const notif = await prisma.notification.findUnique({ where: { notificationKey: `doc-expiry:${documentId}:30d` } });
    expect(notif).not.toBeNull();
    expect(notif!.type).toBe('CLINIC_DOCUMENT_EXPIRING');
    expect(notif!.userId).toBe(clinicAdmin.userId);

    await processDueDocumentExpiryReminders();
    const count = await prisma.notification.count({ where: { notificationKey: `doc-expiry:${documentId}:30d` } });
    expect(count).toBe(1);
  });

  it('sends both the 30-day and 7-day tiers once a document expiring in 5 days is processed', async () => {
    const { documentId } = await setupDocumentDueIn(5);
    await processDueDocumentExpiryReminders();

    const thirtyDay = await prisma.notification.findUnique({ where: { notificationKey: `doc-expiry:${documentId}:30d` } });
    const sevenDay = await prisma.notification.findUnique({ where: { notificationKey: `doc-expiry:${documentId}:7d` } });
    expect(thirtyDay).not.toBeNull();
    expect(sevenDay).not.toBeNull();
  });

  it('sends the expired-tier reminder for a document whose expiry date has already passed', async () => {
    const { documentId } = await setupDocumentDueIn(-2);
    await processDueDocumentExpiryReminders();

    const expiredNotif = await prisma.notification.findUnique({ where: { notificationKey: `doc-expiry:${documentId}:expired` } });
    expect(expiredNotif).not.toBeNull();
    expect(expiredNotif!.title).toContain('expired');
  });

  it('does not fire any tier for a document expiring in 60 days', async () => {
    const { documentId } = await setupDocumentDueIn(60);
    await processDueDocumentExpiryReminders();

    const count = await prisma.notification.count({ where: { relatedEntityType: 'ClinicDocument', relatedEntityId: documentId } });
    expect(count).toBe(0);
  });
});

describe('MANDATORY: simultaneous reminder-scheduler ticks never double-notify', () => {
  it('two concurrent processDueDocumentExpiryReminders calls for the same due document produce exactly one notification per tier', async () => {
    const { documentId } = await setupDocumentDueIn(5);

    await Promise.all([processDueDocumentExpiryReminders(), processDueDocumentExpiryReminders()]);

    const thirtyDayCount = await prisma.notification.count({ where: { notificationKey: `doc-expiry:${documentId}:30d` } });
    const sevenDayCount = await prisma.notification.count({ where: { notificationKey: `doc-expiry:${documentId}:7d` } });
    expect(thirtyDayCount).toBe(1);
    expect(sevenDayCount).toBe(1);
  });
});
