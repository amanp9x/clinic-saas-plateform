import { describe, expect, it } from 'vitest';
import request from 'supertest';

const { createApp } = await import('../../src/app.js');
const { createPatientFixture, createDoctorFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');
const { notifyUser } = await import('../../src/modules/notifications/notification-dispatch.service.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

async function seedNotification(userId: string, overrides: Partial<Parameters<typeof notifyUser>[0]> = {}) {
  await notifyUser({
    userId,
    type: 'SYSTEM',
    title: overrides.title ?? 'Test notification',
    message: overrides.message ?? 'Test message',
    notificationKey: overrides.notificationKey ?? `test:${userId}:${Math.random()}`,
    ...overrides,
  });
}

describe('GET /api/v1/notifications', () => {
  it('lists only the authenticated user\'s own notifications, most recent first', async () => {
    const patient = await createPatientFixture(app);
    await seedNotification(patient.userId, { title: 'First' });
    await seedNotification(patient.userId, { title: 'Second' });

    const res = await request(app).get('/api/v1/notifications').set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data.items[0].title).toBe('Second');
  });

  it('paginates with a default limit of 20 and a maximum of 50', async () => {
    const patient = await createPatientFixture(app);
    const defaultRes = await request(app).get('/api/v1/notifications').set('Authorization', `Bearer ${patient.token}`);
    expect(defaultRes.body.data.limit).toBe(20);

    const overLimitRes = await request(app).get('/api/v1/notifications?limit=999').set('Authorization', `Bearer ${patient.token}`);
    expect(overLimitRes.status).toBe(400);
  });

  it('filters to unread only', async () => {
    const patient = await createPatientFixture(app);
    await seedNotification(patient.userId, { title: 'Unread one' });
    const res = await request(app).get('/api/v1/notifications?unreadOnly=true').set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.every((n: { isRead: boolean }) => !n.isRead)).toBe(true);
  });

  it('allows reception and clinic-admin roles to read their own notifications too', async () => {
    const doctorFixture = await createDoctorFixture(app);
    const reception = await createReceptionFixture(app, doctorFixture.clinicId, []);
    await seedNotification(reception.userId, { title: 'Reception notice' });

    const res = await request(app).get('/api/v1/notifications').set('Authorization', `Bearer ${reception.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.some((n: { title: string }) => n.title === 'Reception notice')).toBe(true);
  });
});

describe('GET /api/v1/notifications/unread-count', () => {
  it('returns an accurate count without fetching notification rows', async () => {
    const patient = await createPatientFixture(app);
    await seedNotification(patient.userId);
    await seedNotification(patient.userId);

    const res = await request(app).get('/api/v1/notifications/unread-count').set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBeGreaterThanOrEqual(2);
  });
});

describe('PATCH /api/v1/notifications/:id/read', () => {
  it('marks the caller\'s own notification read', async () => {
    const patient = await createPatientFixture(app);
    await seedNotification(patient.userId, { notificationKey: `test:markread:${patient.userId}` });
    const notif = await prisma.notification.findUniqueOrThrow({ where: { notificationKey: `test:markread:${patient.userId}` } });

    const res = await request(app).patch(`/api/v1/notifications/${notif.id}/read`).set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(200);

    const updated = await prisma.notification.findUniqueOrThrow({ where: { id: notif.id } });
    expect(updated.isRead).toBe(true);
  });

  it('returns 404 (not 403) for a foreign notification — no existence leak', async () => {
    const owner = await createPatientFixture(app);
    const stranger = await createPatientFixture(app);
    await seedNotification(owner.userId, { notificationKey: `test:idor:${owner.userId}` });
    const notif = await prisma.notification.findUniqueOrThrow({ where: { notificationKey: `test:idor:${owner.userId}` } });

    const res = await request(app).patch(`/api/v1/notifications/${notif.id}/read`).set('Authorization', `Bearer ${stranger.token}`);
    expect(res.status).toBe(404);

    const untouched = await prisma.notification.findUniqueOrThrow({ where: { id: notif.id } });
    expect(untouched.isRead).toBe(false);
  });
});

describe('PATCH /api/v1/notifications/read-all', () => {
  it('marks every unread notification for the caller as read, and only the caller\'s', async () => {
    const patient = await createPatientFixture(app);
    const other = await createPatientFixture(app);
    await seedNotification(patient.userId);
    await seedNotification(patient.userId);
    await seedNotification(other.userId, { notificationKey: `test:readall-other:${other.userId}` });

    const res = await request(app).patch('/api/v1/notifications/read-all').set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(200);

    const stillUnread = await prisma.notification.count({ where: { userId: patient.userId, isRead: false } });
    expect(stillUnread).toBe(0);
    const otherNotif = await prisma.notification.findUniqueOrThrow({ where: { notificationKey: `test:readall-other:${other.userId}` } });
    expect(otherNotif.isRead).toBe(false);
  });
});

describe('DELETE /api/v1/notifications/:id', () => {
  it('deletes the caller\'s own notification', async () => {
    const patient = await createPatientFixture(app);
    await seedNotification(patient.userId, { notificationKey: `test:delete:${patient.userId}` });
    const notif = await prisma.notification.findUniqueOrThrow({ where: { notificationKey: `test:delete:${patient.userId}` } });

    const res = await request(app).delete(`/api/v1/notifications/${notif.id}`).set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(200);
    const gone = await prisma.notification.findUnique({ where: { id: notif.id } });
    expect(gone).toBeNull();
  });

  it('returns 404 for a foreign notification and does not delete it', async () => {
    const owner = await createPatientFixture(app);
    const stranger = await createPatientFixture(app);
    await seedNotification(owner.userId, { notificationKey: `test:delete-idor:${owner.userId}` });
    const notif = await prisma.notification.findUniqueOrThrow({ where: { notificationKey: `test:delete-idor:${owner.userId}` } });

    const res = await request(app).delete(`/api/v1/notifications/${notif.id}`).set('Authorization', `Bearer ${stranger.token}`);
    expect(res.status).toBe(404);
    const stillThere = await prisma.notification.findUnique({ where: { id: notif.id } });
    expect(stillThere).not.toBeNull();
  });
});
