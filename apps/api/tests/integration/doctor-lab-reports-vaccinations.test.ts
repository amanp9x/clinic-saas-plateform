import { describe, expect, it } from 'vitest';
import request from 'supertest';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture } = await import('../helpers/doctor-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

async function setupCareRelationship() {
  const fixture = await createDoctorFixture(app);
  const patient = await createPatientFixture(app);
  await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });
  return { fixture, patient };
}

async function orderLabReport(token: string, patientId: string, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post(`/api/v1/doctor/patients/${patientId}/lab-reports`)
    .set('Authorization', `Bearer ${token}`)
    .send({ testName: 'Complete Blood Count', labName: 'City Diagnostics', ...overrides });
  expect(res.status).toBe(201);
  return res.body.data.report as { id: string; status: string; testName: string };
}

describe('POST /api/v1/doctor/patients/:patientId/lab-reports', () => {
  it('orders a test, defaulting to PENDING', async () => {
    const { fixture, patient } = await setupCareRelationship();
    const report = await orderLabReport(fixture.token, patient.patientId);
    expect(report.status).toBe('PENDING');
    expect(report.testName).toBe('Complete Blood Count');
  });

  it('a doctor with no care relationship to the patient is rejected (IDOR-safe 404)', async () => {
    const fixtureA = await createDoctorFixture(app);
    const fixtureB = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixtureA.doctorId, clinicId: fixtureA.clinicId, status: 'COMPLETED' });

    const res = await request(app)
      .post(`/api/v1/doctor/patients/${patient.patientId}/lab-reports`)
      .set('Authorization', `Bearer ${fixtureB.token}`)
      .send({ testName: 'X-Ray' });
    expect(res.status).toBe(404);
  });

  it('rejects a non-doctor role', async () => {
    const patient = await createPatientFixture(app);
    const res = await request(app)
      .post(`/api/v1/doctor/patients/${patient.patientId}/lab-reports`)
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ testName: 'X-Ray' });
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/v1/doctor/patients/:patientId/lab-reports/:id', () => {
  it('updates notes without changing status', async () => {
    const { fixture, patient } = await setupCareRelationship();
    const report = await orderLabReport(fixture.token, patient.patientId);

    const res = await request(app)
      .patch(`/api/v1/doctor/patients/${patient.patientId}/lab-reports/${report.id}`)
      .set('Authorization', `Bearer ${fixture.token}`)
      .field('notes', 'Sample collected, awaiting results');
    expect(res.status).toBe(200);
    expect(res.body.data.report.status).toBe('PENDING');
    expect(res.body.data.report.notes).toBe('Sample collected, awaiting results');
  });

  it('rejects marking READY without a report date', async () => {
    const { fixture, patient } = await setupCareRelationship();
    const report = await orderLabReport(fixture.token, patient.patientId);

    const res = await request(app)
      .patch(`/api/v1/doctor/patients/${patient.patientId}/lab-reports/${report.id}`)
      .set('Authorization', `Bearer ${fixture.token}`)
      .field('status', 'READY');
    expect(res.status).toBe(400);
  });

  it('marks READY with a report date, notifies the patient exactly once, and never re-notifies on a follow-up update', async () => {
    const { fixture, patient } = await setupCareRelationship();
    const report = await orderLabReport(fixture.token, patient.patientId);

    const res = await request(app)
      .patch(`/api/v1/doctor/patients/${patient.patientId}/lab-reports/${report.id}`)
      .set('Authorization', `Bearer ${fixture.token}`)
      .field('status', 'READY')
      .field('reportDate', '2026-08-19');
    expect(res.status).toBe(200);
    expect(res.body.data.report.status).toBe('READY');

    const notif = await prisma.notification.findUnique({ where: { notificationKey: `lab-report:${report.id}:ready` } });
    expect(notif).not.toBeNull();
    expect(notif!.type).toBe('REPORT_READY');
    expect(notif!.userId).toBe(patient.userId);

    const second = await request(app)
      .patch(`/api/v1/doctor/patients/${patient.patientId}/lab-reports/${report.id}`)
      .set('Authorization', `Bearer ${fixture.token}`)
      .field('notes', 'Reviewed with patient');
    expect(second.status).toBe(200);
    expect(second.body.data.report.status).toBe('READY');

    const count = await prisma.notification.count({ where: { notificationKey: `lab-report:${report.id}:ready` } });
    expect(count).toBe(1);
  });

  it('attaches a report file', async () => {
    const { fixture, patient } = await setupCareRelationship();
    const report = await orderLabReport(fixture.token, patient.patientId);

    const res = await request(app)
      .patch(`/api/v1/doctor/patients/${patient.patientId}/lab-reports/${report.id}`)
      .set('Authorization', `Bearer ${fixture.token}`)
      .field('reportDate', '2026-08-19')
      .attach('file', Buffer.from('%PDF-1.4 fake report'), { filename: 'cbc-result.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(200);
    expect(res.body.data.report.fileUrl).toContain('.pdf');
  });

  it('a doctor with no care relationship cannot update the report (IDOR-safe 404)', async () => {
    const { fixture, patient } = await setupCareRelationship();
    const report = await orderLabReport(fixture.token, patient.patientId);
    const otherFixture = await createDoctorFixture(app);

    const res = await request(app)
      .patch(`/api/v1/doctor/patients/${patient.patientId}/lab-reports/${report.id}`)
      .set('Authorization', `Bearer ${otherFixture.token}`)
      .field('notes', 'snooping');
    expect(res.status).toBe(404);
  });

  it('returns 404 for a report id that belongs to a different patient', async () => {
    const { fixture, patient } = await setupCareRelationship();
    const report = await orderLabReport(fixture.token, patient.patientId);
    const otherPatient = await createPatientFixture(app);
    await createAppointmentFixture({ patientId: otherPatient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });

    const res = await request(app)
      .patch(`/api/v1/doctor/patients/${otherPatient.patientId}/lab-reports/${report.id}`)
      .set('Authorization', `Bearer ${fixture.token}`)
      .field('notes', 'wrong patient scope');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/doctor/patients/:patientId/vaccinations', () => {
  it('records a vaccination and it appears in the patient medical history', async () => {
    const { fixture, patient } = await setupCareRelationship();

    const res = await request(app)
      .post(`/api/v1/doctor/patients/${patient.patientId}/vaccinations`)
      .set('Authorization', `Bearer ${fixture.token}`)
      .send({ vaccineName: 'Tetanus', doseNumber: 1, administeredDate: '2026-08-19' });
    expect(res.status).toBe(201);
    expect(res.body.data.vaccination.vaccineName).toBe('Tetanus');

    const history = await request(app)
      .get(`/api/v1/doctor/patients/${patient.patientId}/medical-history`)
      .set('Authorization', `Bearer ${fixture.token}`);
    expect(history.body.data.history.vaccinations.some((v: { vaccineName: string }) => v.vaccineName === 'Tetanus')).toBe(true);
  });

  it('a doctor with no care relationship cannot record a vaccination (IDOR-safe 404)', async () => {
    const { patient } = await setupCareRelationship();
    const otherFixture = await createDoctorFixture(app);

    const res = await request(app)
      .post(`/api/v1/doctor/patients/${patient.patientId}/vaccinations`)
      .set('Authorization', `Bearer ${otherFixture.token}`)
      .send({ vaccineName: 'Tetanus', administeredDate: '2026-08-19' });
    expect(res.status).toBe(404);
  });
});

describe('MANDATORY: two concurrent READY updates on the same lab report never double-notify', () => {
  it('both requests succeed at the HTTP layer, but exactly one REPORT_READY notification is created', async () => {
    const { fixture, patient } = await setupCareRelationship();
    const report = await orderLabReport(fixture.token, patient.patientId);

    const [a, b] = await Promise.all([
      request(app)
        .patch(`/api/v1/doctor/patients/${patient.patientId}/lab-reports/${report.id}`)
        .set('Authorization', `Bearer ${fixture.token}`)
        .field('status', 'READY')
        .field('reportDate', '2026-08-19'),
      request(app)
        .patch(`/api/v1/doctor/patients/${patient.patientId}/lab-reports/${report.id}`)
        .set('Authorization', `Bearer ${fixture.token}`)
        .field('status', 'READY')
        .field('reportDate', '2026-08-19'),
    ]);

    expect([a.status, b.status]).toEqual([200, 200]);

    const count = await prisma.notification.count({ where: { notificationKey: `lab-report:${report.id}:ready` } });
    expect(count).toBe(1);
  });
});
