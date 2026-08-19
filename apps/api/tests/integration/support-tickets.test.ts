import { describe, expect, it } from 'vitest';
import request from 'supertest';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture } = await import('../helpers/doctor-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

async function createTicket(token: string, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/api/v1/support/tickets')
    .set('Authorization', `Bearer ${token}`)
    .send({ category: 'TECHNICAL', subject: 'App keeps crashing', description: 'The app crashes every time I open my appointments tab.', ...overrides });
  expect(res.status).toBe(201);
  return res.body.data.ticket as { id: string; ticketNumber: string; status: string; clinicId: string | null };
}

describe('POST /api/v1/support/tickets', () => {
  it('creates a ticket with no linked resource', async () => {
    const patient = await createPatientFixture(app);
    const ticket = await createTicket(patient.token);
    expect(ticket.ticketNumber).toMatch(/^TCK-\d{8}-[A-Z2-9]{5}$/);
    expect(ticket.status).toBe('OPEN');
    expect(ticket.clinicId).toBeNull();
  });

  it('derives clinicId server-side from an owned, linked appointment', async () => {
    const patient = await createPatientFixture(app);
    const fixture = await createDoctorFixture(app);
    const appointment = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId });

    const ticket = await createTicket(patient.token, { category: 'APPOINTMENT', appointmentId: appointment.id });
    expect(ticket.clinicId).toBe(fixture.clinicId);
  });

  it('a client-supplied appointmentId belonging to a different patient is rejected as not-found (IDOR-safe)', async () => {
    const patientA = await createPatientFixture(app);
    const patientB = await createPatientFixture(app);
    const fixture = await createDoctorFixture(app);
    const appointment = await createAppointmentFixture({ patientId: patientA.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId });

    const res = await request(app)
      .post('/api/v1/support/tickets')
      .set('Authorization', `Bearer ${patientB.token}`)
      .send({ category: 'APPOINTMENT', subject: 'Not my appointment', description: 'Trying to link someone else appointment to my ticket.', appointmentId: appointment.id });
    expect(res.status).toBe(404);
  });

  it('rejects a non-patient role', async () => {
    const fixture = await createDoctorFixture(app);
    const res = await request(app)
      .post('/api/v1/support/tickets')
      .set('Authorization', `Bearer ${fixture.token}`)
      .send({ category: 'OTHER', subject: 'Doctor trying', description: 'Doctors should not be able to raise patient support tickets.' });
    expect(res.status).toBe(403);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).post('/api/v1/support/tickets').send({ category: 'OTHER', subject: 'x', description: 'x'.repeat(10) });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/support/tickets', () => {
  it('lists only the caller own tickets, filterable by status', async () => {
    const patientA = await createPatientFixture(app);
    const patientB = await createPatientFixture(app);
    const ticket = await createTicket(patientA.token);
    await createTicket(patientB.token);

    const res = await request(app).get('/api/v1/support/tickets').set('Authorization', `Bearer ${patientA.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.items[0].id).toBe(ticket.id);

    const filtered = await request(app).get('/api/v1/support/tickets?status=RESOLVED').set('Authorization', `Bearer ${patientA.token}`);
    expect(filtered.body.data.items.length).toBe(0);
  });
});

describe('GET /api/v1/support/tickets/:id', () => {
  it('returns 404 for a ticket raised by a different patient', async () => {
    const patientA = await createPatientFixture(app);
    const patientB = await createPatientFixture(app);
    const ticket = await createTicket(patientA.token);

    const res = await request(app).get(`/api/v1/support/tickets/${ticket.id}`).set('Authorization', `Bearer ${patientB.token}`);
    expect(res.status).toBe(404);
  });

  it('returns the ticket with its message thread for the owner', async () => {
    const patient = await createPatientFixture(app);
    const ticket = await createTicket(patient.token);
    const res = await request(app).get(`/api/v1/support/tickets/${ticket.id}`).set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.ticket.messages)).toBe(true);
  });
});

describe('POST /api/v1/support/tickets/:id/messages', () => {
  it('the owner can add a message to their own open ticket', async () => {
    const patient = await createPatientFixture(app);
    const ticket = await createTicket(patient.token);
    const res = await request(app)
      .post(`/api/v1/support/tickets/${ticket.id}/messages`)
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ message: 'Any update on this?' });
    expect(res.status).toBe(200);
    expect(res.body.data.ticket.messages.length).toBe(1);
    expect(res.body.data.ticket.messages[0].isFromAdmin).toBe(false);
  });

  it('a different patient cannot message someone else ticket (IDOR-safe 404)', async () => {
    const patientA = await createPatientFixture(app);
    const patientB = await createPatientFixture(app);
    const ticket = await createTicket(patientA.token);
    const res = await request(app)
      .post(`/api/v1/support/tickets/${ticket.id}/messages`)
      .set('Authorization', `Bearer ${patientB.token}`)
      .send({ message: 'Snooping' });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/support/tickets/:id/withdraw', () => {
  it('withdraws an open ticket', async () => {
    const patient = await createPatientFixture(app);
    const ticket = await createTicket(patient.token);
    const res = await request(app).patch(`/api/v1/support/tickets/${ticket.id}/withdraw`).set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.ticket.status).toBe('CLOSED');
  });

  it('cannot withdraw a ticket that has already been picked up', async () => {
    const patient = await createPatientFixture(app);
    const ticket = await createTicket(patient.token);
    await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: 'IN_PROGRESS' } });

    const res = await request(app).patch(`/api/v1/support/tickets/${ticket.id}/withdraw`).set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(409);
  });
});

describe('PATCH /api/v1/support/tickets/:id/reopen', () => {
  it('reopens a resolved ticket back into IN_PROGRESS', async () => {
    const patient = await createPatientFixture(app);
    const ticket = await createTicket(patient.token);
    await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: 'RESOLVED', resolutionNotes: 'Fixed', resolvedAt: new Date() } });

    const res = await request(app).patch(`/api/v1/support/tickets/${ticket.id}/reopen`).set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.ticket.status).toBe('IN_PROGRESS');
  });

  it('cannot reopen a ticket that was never resolved', async () => {
    const patient = await createPatientFixture(app);
    const ticket = await createTicket(patient.token);
    const res = await request(app).patch(`/api/v1/support/tickets/${ticket.id}/reopen`).set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(409);
  });
});
