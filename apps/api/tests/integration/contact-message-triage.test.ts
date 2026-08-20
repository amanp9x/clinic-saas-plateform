import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const { sendEmailMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn((_args: { to: string; subject: string; html: string; text: string }) => Promise.resolve()),
}));
vi.mock('../../src/services/mailer.service.js', () => ({ sendEmail: sendEmailMock }));

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createPlatformAdminFixture } = await import('../helpers/doctor-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

async function submitMessage(overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/v1/contact')
    .send({
      name: 'Asha Kulkarni',
      email: 'asha.kulkarni@example.com',
      subject: 'Question about billing',
      message: 'I was charged twice for my last appointment, can someone look into this please?',
      ...overrides,
    });
  expect(res.status).toBe(201);
  const created = await prisma.contactMessage.findFirstOrThrow({ where: { email: (overrides.email as string) ?? 'asha.kulkarni@example.com' }, orderBy: { createdAt: 'desc' } });
  return created;
}

describe('POST /api/v1/contact', () => {
  it('writes a NEW message and records an audit log, with no admin-visible reply yet', async () => {
    const message = await submitMessage({ email: 'writes-test@example.com' });
    expect(message.status).toBe('NEW');
    expect(message.adminReply).toBeNull();

    const audit = await prisma.auditLog.findFirst({ where: { entityType: 'ContactMessage', entityId: message.id, action: 'contact.message_submitted' } });
    expect(audit).not.toBeNull();
  });
});

describe('GET /api/v1/platform-admin/contact-messages', () => {
  it('lists messages, filterable by status and search', async () => {
    const admin = await createPlatformAdminFixture(app);
    const message = await submitMessage({ email: 'list-filter-test@example.com', subject: 'Unique Subject Marker 12345' });

    const all = await request(app).get('/api/v1/platform-admin/contact-messages').set('Authorization', `Bearer ${admin.token}`);
    expect(all.status).toBe(200);
    expect(all.body.data.items.some((m: { id: string }) => m.id === message.id)).toBe(true);

    const byStatus = await request(app).get('/api/v1/platform-admin/contact-messages?status=NEW').set('Authorization', `Bearer ${admin.token}`);
    expect(byStatus.body.data.items.some((m: { id: string }) => m.id === message.id)).toBe(true);

    const wrongStatus = await request(app).get('/api/v1/platform-admin/contact-messages?status=RESOLVED').set('Authorization', `Bearer ${admin.token}`);
    expect(wrongStatus.body.data.items.some((m: { id: string }) => m.id === message.id)).toBe(false);

    const bySearch = await request(app).get('/api/v1/platform-admin/contact-messages?search=Unique%20Subject%20Marker').set('Authorization', `Bearer ${admin.token}`);
    expect(bySearch.body.data.items.some((m: { id: string }) => m.id === message.id)).toBe(true);
  });

  it('rejects a patient and a doctor', async () => {
    const patient = await createPatientFixture(app);
    const doctor = await createDoctorFixture(app);
    for (const token of [patient.token, doctor.token]) {
      const res = await request(app).get('/api/v1/platform-admin/contact-messages').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    }
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/platform-admin/contact-messages');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/platform-admin/contact-messages/:id', () => {
  it('returns 404 for a nonexistent message', async () => {
    const admin = await createPlatformAdminFixture(app);
    const res = await request(app).get('/api/v1/platform-admin/contact-messages/00000000-0000-0000-0000-000000000000').set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/platform-admin/contact-messages/:id/status', () => {
  it('drives a message through NEW -> IN_PROGRESS -> RESOLVED and sends exactly one reply email', async () => {
    sendEmailMock.mockClear();
    const admin = await createPlatformAdminFixture(app);
    const message = await submitMessage({ email: 'lifecycle-test@example.com' });

    const toInProgress = await request(app)
      .patch(`/api/v1/platform-admin/contact-messages/${message.id}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'IN_PROGRESS' });
    expect(toInProgress.status).toBe(200);
    expect(toInProgress.body.data.message.status).toBe('IN_PROGRESS');
    expect(sendEmailMock).not.toHaveBeenCalled();

    const toResolved = await request(app)
      .patch(`/api/v1/platform-admin/contact-messages/${message.id}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'RESOLVED', adminReply: 'We have refunded the duplicate charge — sorry for the trouble!' });
    expect(toResolved.status).toBe(200);
    expect(toResolved.body.data.message.status).toBe('RESOLVED');
    expect(toResolved.body.data.message.adminReply).toContain('refunded');

    expect(sendEmailMock).toHaveBeenCalledOnce();
    expect(sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: 'lifecycle-test@example.com' }));

    const audit = await prisma.auditLog.findFirst({ where: { entityType: 'ContactMessage', entityId: message.id, action: 'platform.contact_message_status_updated' } });
    expect(audit).not.toBeNull();
  });

  it('resolving without a reply does not send an email', async () => {
    sendEmailMock.mockClear();
    const admin = await createPlatformAdminFixture(app);
    const message = await submitMessage({ email: 'no-reply-test@example.com' });

    const res = await request(app)
      .patch(`/api/v1/platform-admin/contact-messages/${message.id}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'RESOLVED' });
    expect(res.status).toBe(200);
    expect(res.body.data.message.adminReply).toBeNull();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid transition — a resolved message cannot be reopened', async () => {
    const admin = await createPlatformAdminFixture(app);
    const message = await submitMessage({ email: 'invalid-transition-test@example.com' });
    await request(app).patch(`/api/v1/platform-admin/contact-messages/${message.id}/status`).set('Authorization', `Bearer ${admin.token}`).send({ status: 'RESOLVED' });

    const res = await request(app)
      .patch(`/api/v1/platform-admin/contact-messages/${message.id}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(409);
  });

  it('rejects an invalid status value', async () => {
    const admin = await createPlatformAdminFixture(app);
    const message = await submitMessage({ email: 'invalid-status-test@example.com' });
    const res = await request(app)
      .patch(`/api/v1/platform-admin/contact-messages/${message.id}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'NEW' });
    expect(res.status).toBe(400);
  });

  it('a non-platform-admin cannot update message status', async () => {
    const patient = await createPatientFixture(app);
    const message = await submitMessage({ email: 'rbac-test@example.com' });
    const res = await request(app)
      .patch(`/api/v1/platform-admin/contact-messages/${message.id}/status`)
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request', async () => {
    const message = await submitMessage({ email: 'unauth-test@example.com' });
    const res = await request(app).patch(`/api/v1/platform-admin/contact-messages/${message.id}/status`).send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(401);
  });
});

describe('MANDATORY: two concurrent admin status decisions on the same message never send duplicate replies', () => {
  it('exactly one of two concurrent RESOLVE-with-reply requests succeeds; exactly one reply email is sent', async () => {
    sendEmailMock.mockClear();
    const admin = await createPlatformAdminFixture(app);
    const message = await submitMessage({ email: 'concurrency-test@example.com' });

    const [a, b] = await Promise.all([
      request(app)
        .patch(`/api/v1/platform-admin/contact-messages/${message.id}/status`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'RESOLVED', adminReply: 'Reply A' }),
      request(app)
        .patch(`/api/v1/platform-admin/contact-messages/${message.id}/status`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'RESOLVED', adminReply: 'Reply B' }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);

    const final = await prisma.contactMessage.findUniqueOrThrow({ where: { id: message.id } });
    expect(final.status).toBe('RESOLVED');
    expect(['Reply A', 'Reply B']).toContain(final.adminReply);

    expect(sendEmailMock).toHaveBeenCalledOnce();
  });

  it('an IN_PROGRESS claim and a RESOLVE claim racing the same NEW message: exactly one wins', async () => {
    sendEmailMock.mockClear();
    const admin = await createPlatformAdminFixture(app);
    const message = await submitMessage({ email: 'concurrency-test-2@example.com' });

    const [a, b] = await Promise.all([
      request(app).patch(`/api/v1/platform-admin/contact-messages/${message.id}/status`).set('Authorization', `Bearer ${admin.token}`).send({ status: 'IN_PROGRESS' }),
      request(app)
        .patch(`/api/v1/platform-admin/contact-messages/${message.id}/status`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ status: 'RESOLVED', adminReply: 'Resolved directly' }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);

    const final = await prisma.contactMessage.findUniqueOrThrow({ where: { id: message.id } });
    expect(['IN_PROGRESS', 'RESOLVED']).toContain(final.status);
    // At most one email — never one per racer.
    expect(sendEmailMock.mock.calls.length).toBeLessThanOrEqual(1);
  });
});
