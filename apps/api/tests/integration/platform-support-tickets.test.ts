import { describe, expect, it } from 'vitest';
import request from 'supertest';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createPlatformAdminFixture } = await import('../helpers/doctor-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

async function createTicket(token: string, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/v1/support/tickets')
    .set('Authorization', `Bearer ${token}`)
    .send({ category: 'TECHNICAL', subject: 'Something is broken', description: 'Describing the issue in enough detail to pass validation.', ...overrides });
  expect(res.status).toBe(201);
  return res.body.data.ticket as { id: string; ticketNumber: string; status: string };
}

describe('GET /api/v1/platform-admin/tickets', () => {
  it('lists tickets across all patients, filterable by status and category', async () => {
    const admin = await createPlatformAdminFixture(app);
    const patient = await createPatientFixture(app);
    const ticket = await createTicket(patient.token, { category: 'PAYMENT' });

    const all = await request(app).get('/api/v1/platform-admin/tickets').set('Authorization', `Bearer ${admin.token}`);
    expect(all.status).toBe(200);
    expect(all.body.data.items.some((t: { id: string }) => t.id === ticket.id)).toBe(true);

    const filtered = await request(app).get('/api/v1/platform-admin/tickets?category=PAYMENT&status=OPEN').set('Authorization', `Bearer ${admin.token}`);
    expect(filtered.body.data.items.some((t: { id: string }) => t.id === ticket.id)).toBe(true);

    const wrongCategory = await request(app).get('/api/v1/platform-admin/tickets?category=TECHNICAL&status=RESOLVED').set('Authorization', `Bearer ${admin.token}`);
    expect(wrongCategory.body.data.items.some((t: { id: string }) => t.id === ticket.id)).toBe(false);
  });

  it('rejects a patient and a doctor', async () => {
    const patient = await createPatientFixture(app);
    const fixture = await createDoctorFixture(app);
    for (const token of [patient.token, fixture.token]) {
      const res = await request(app).get('/api/v1/platform-admin/tickets').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    }
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/platform-admin/tickets');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/platform-admin/tickets/:id', () => {
  it('returns 404 for a nonexistent ticket', async () => {
    const admin = await createPlatformAdminFixture(app);
    const res = await request(app).get('/api/v1/platform-admin/tickets/00000000-0000-0000-0000-000000000000').set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/platform-admin/tickets/:id/status', () => {
  it('drives a ticket through the full OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED lifecycle and notifies the patient', async () => {
    const admin = await createPlatformAdminFixture(app);
    const patient = await createPatientFixture(app);
    const ticket = await createTicket(patient.token);

    const toInProgress = await request(app)
      .patch(`/api/v1/platform-admin/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'IN_PROGRESS' });
    expect(toInProgress.status).toBe(200);
    expect(toInProgress.body.data.ticket.status).toBe('IN_PROGRESS');

    const toResolved = await request(app)
      .patch(`/api/v1/platform-admin/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'RESOLVED', resolutionNotes: 'Cleared the app cache and reinstalled; confirmed fixed.' });
    expect(toResolved.status).toBe(200);
    expect(toResolved.body.data.ticket.status).toBe('RESOLVED');
    expect(toResolved.body.data.ticket.resolutionNotes).toContain('cache');

    const toClosed = await request(app)
      .patch(`/api/v1/platform-admin/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'CLOSED' });
    expect(toClosed.status).toBe(200);
    expect(toClosed.body.data.ticket.status).toBe('CLOSED');

    const notif = await prisma.notification.findFirst({ where: { userId: patient.userId, type: 'SUPPORT_TICKET_UPDATE' } });
    expect(notif).not.toBeNull();
  });

  it('rejects an invalid transition — an open ticket cannot jump straight to RESOLVED', async () => {
    const admin = await createPlatformAdminFixture(app);
    const patient = await createPatientFixture(app);
    const ticket = await createTicket(patient.token);

    const res = await request(app)
      .patch(`/api/v1/platform-admin/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'RESOLVED', resolutionNotes: 'skip ahead' });
    expect(res.status).toBe(409);
  });

  it('requires resolution notes to resolve a ticket', async () => {
    const admin = await createPlatformAdminFixture(app);
    const patient = await createPatientFixture(app);
    const ticket = await createTicket(patient.token);
    await request(app).patch(`/api/v1/platform-admin/tickets/${ticket.id}/status`).set('Authorization', `Bearer ${admin.token}`).send({ status: 'IN_PROGRESS' });

    const res = await request(app).patch(`/api/v1/platform-admin/tickets/${ticket.id}/status`).set('Authorization', `Bearer ${admin.token}`).send({ status: 'RESOLVED' });
    expect(res.status).toBe(400);
  });

  it('a non-platform-admin cannot update ticket status', async () => {
    const patient = await createPatientFixture(app);
    const ticket = await createTicket(patient.token);
    const res = await request(app).patch(`/api/v1/platform-admin/tickets/${ticket.id}/status`).set('Authorization', `Bearer ${patient.token}`).send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/platform-admin/tickets/:id/messages', () => {
  it('an admin reply is visible on the thread and notifies the patient', async () => {
    const admin = await createPlatformAdminFixture(app);
    const patient = await createPatientFixture(app);
    const ticket = await createTicket(patient.token);

    const res = await request(app)
      .post(`/api/v1/platform-admin/tickets/${ticket.id}/messages`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ message: 'Could you share a screenshot of the crash?' });
    expect(res.status).toBe(200);
    const messages = res.body.data.ticket.messages as { isFromAdmin: boolean; senderName: string }[];
    expect(messages.some((m) => m.isFromAdmin && m.senderName === 'Support Team')).toBe(true);
  });

  it('cannot message a closed ticket', async () => {
    const admin = await createPlatformAdminFixture(app);
    const patient = await createPatientFixture(app);
    const ticket = await createTicket(patient.token);
    await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: 'CLOSED' } });

    const res = await request(app).post(`/api/v1/platform-admin/tickets/${ticket.id}/messages`).set('Authorization', `Bearer ${admin.token}`).send({ message: 'too late' });
    expect(res.status).toBe(409);
  });
});

describe('MANDATORY: two concurrent admin status decisions on the same ticket never corrupt the final state', () => {
  it('both individually-valid decisions succeed at the HTTP layer, but the row lands on exactly one consistent final status', async () => {
    const admin = await createPlatformAdminFixture(app);
    const patient = await createPatientFixture(app);
    const ticket = await createTicket(patient.token);
    await request(app).patch(`/api/v1/platform-admin/tickets/${ticket.id}/status`).set('Authorization', `Bearer ${admin.token}`).send({ status: 'IN_PROGRESS' });

    const [a, b] = await Promise.all([
      request(app).patch(`/api/v1/platform-admin/tickets/${ticket.id}/status`).set('Authorization', `Bearer ${admin.token}`).send({ status: 'RESOLVED', resolutionNotes: 'race A' }),
      request(app).patch(`/api/v1/platform-admin/tickets/${ticket.id}/status`).set('Authorization', `Bearer ${admin.token}`).send({ status: 'CLOSED' }),
    ]);

    expect([a.status, b.status]).toEqual([200, 200]);

    const final = await prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(['RESOLVED', 'CLOSED']).toContain(final.status);
  });
});
