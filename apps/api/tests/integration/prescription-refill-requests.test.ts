import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture } = await import('../helpers/doctor-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

async function createFinalizedPrescription(doctorId: string, patientId: string, medicineNames = ['Amlodipine']) {
  return prisma.prescription.create({
    data: {
      doctorId,
      patientId,
      status: 'FINALIZED',
      medications: [],
      diagnosis: 'Hypertension',
      advice: 'Monitor blood pressure weekly',
      signedAt: new Date(),
      pdfUrl: '/uploads/prescriptions/fixture.pdf',
      items: {
        create: medicineNames.map((medicineName, index) => ({
          sortOrder: index,
          medicineName,
          dosage: '5mg',
          frequency: 'Once daily',
          duration: '30 days',
        })),
      },
    },
    include: { items: true },
  });
}

let doctor: Awaited<ReturnType<typeof createDoctorFixture>>;
let otherDoctor: Awaited<ReturnType<typeof createDoctorFixture>>;
let patient: Awaited<ReturnType<typeof createPatientFixture>>;
let otherPatient: Awaited<ReturnType<typeof createPatientFixture>>;

beforeAll(async () => {
  doctor = await createDoctorFixture(app);
  otherDoctor = await createDoctorFixture(app);
  patient = await createPatientFixture(app);
  otherPatient = await createPatientFixture(app);
});

describe('Prescription refill requests — patient creates', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/prescriptions/refill-requests');
    expect(res.status).toBe(401);
  });

  it('rejects a doctor calling the patient-only endpoint', async () => {
    const res = await request(app).get('/api/v1/prescriptions/refill-requests').set('Authorization', `Bearer ${doctor.token}`);
    expect(res.status).toBe(403);
  });

  it('rejects invalid input', async () => {
    const res = await request(app).post('/api/v1/prescriptions/not-a-uuid/refill-requests').set('Authorization', `Bearer ${patient.token}`).send({});
    expect(res.status).toBe(400);
  });

  it('404s for a nonexistent prescription', async () => {
    const res = await request(app)
      .post(`/api/v1/prescriptions/${randomUUID()}/refill-requests`)
      .set('Authorization', `Bearer ${patient.token}`)
      .send({});
    expect(res.status).toBe(404);
  });

  it('404s (not 403) for another patient\'s prescription — IDOR', async () => {
    const rx = await createFinalizedPrescription(doctor.doctorId, otherPatient.patientId);
    const res = await request(app).post(`/api/v1/prescriptions/${rx.id}/refill-requests`).set('Authorization', `Bearer ${patient.token}`).send({});
    expect(res.status).toBe(404);
  });

  it('rejects a refill request on a DRAFT prescription', async () => {
    const draft = await prisma.prescription.create({
      data: { doctorId: doctor.doctorId, patientId: patient.patientId, status: 'DRAFT', medications: [] },
    });
    const res = await request(app).post(`/api/v1/prescriptions/${draft.id}/refill-requests`).set('Authorization', `Bearer ${patient.token}`).send({});
    expect(res.status).toBe(409);
  });

  it('creates a refill request for an owned finalized prescription', async () => {
    const rx = await createFinalizedPrescription(doctor.doctorId, patient.patientId);
    const res = await request(app)
      .post(`/api/v1/prescriptions/${rx.id}/refill-requests`)
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ patientNote: 'Running low, same dosage please' });

    expect(res.status).toBe(201);
    expect(res.body.data.request.status).toBe('PENDING');
    expect(res.body.data.request.patientNote).toBe('Running low, same dosage please');
    expect(res.body.data.request.doctorId).toBe(doctor.doctorId);
    expect(res.body.data.request.originalPrescription.medicineNames).toEqual(['Amlodipine']);

    const audit = await prisma.auditLog.findFirst({
      where: { entityType: 'PrescriptionRefillRequest', entityId: res.body.data.request.id, action: 'patient.refill_requested' },
    });
    expect(audit).not.toBeNull();
  });

  it('rejects a duplicate pending request for the same prescription', async () => {
    const rx = await createFinalizedPrescription(doctor.doctorId, patient.patientId);
    const first = await request(app).post(`/api/v1/prescriptions/${rx.id}/refill-requests`).set('Authorization', `Bearer ${patient.token}`).send({});
    expect(first.status).toBe(201);

    const second = await request(app).post(`/api/v1/prescriptions/${rx.id}/refill-requests`).set('Authorization', `Bearer ${patient.token}`).send({});
    expect(second.status).toBe(409);
  });

  it('lists only the requesting patient\'s own refill requests', async () => {
    const rxMine = await createFinalizedPrescription(doctor.doctorId, patient.patientId);
    const rxOther = await createFinalizedPrescription(doctor.doctorId, otherPatient.patientId);
    await request(app).post(`/api/v1/prescriptions/${rxMine.id}/refill-requests`).set('Authorization', `Bearer ${patient.token}`).send({});
    await request(app).post(`/api/v1/prescriptions/${rxOther.id}/refill-requests`).set('Authorization', `Bearer ${otherPatient.token}`).send({});

    const res = await request(app).get('/api/v1/prescriptions/refill-requests').set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.every((r: { patientId: string }) => r.patientId === patient.patientId)).toBe(true);
  });
});

describe('Prescription refill requests — doctor responds', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/doctor/refill-requests');
    expect(res.status).toBe(401);
  });

  it('rejects a patient calling the doctor-only endpoint', async () => {
    const res = await request(app).get('/api/v1/doctor/refill-requests').set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(403);
  });

  it('404s (not 403) for a request belonging to another doctor — IDOR', async () => {
    const rx = await createFinalizedPrescription(doctor.doctorId, patient.patientId);
    const created = await request(app).post(`/api/v1/prescriptions/${rx.id}/refill-requests`).set('Authorization', `Bearer ${patient.token}`).send({});
    const id = created.body.data.request.id;

    const res = await request(app).patch(`/api/v1/doctor/refill-requests/${id}`).set('Authorization', `Bearer ${otherDoctor.token}`).send({ status: 'APPROVED' });
    expect(res.status).toBe(404);
  });

  it('rejects an invalid status value', async () => {
    const rx = await createFinalizedPrescription(doctor.doctorId, patient.patientId);
    const created = await request(app).post(`/api/v1/prescriptions/${rx.id}/refill-requests`).set('Authorization', `Bearer ${patient.token}`).send({});
    const id = created.body.data.request.id;

    const res = await request(app).patch(`/api/v1/doctor/refill-requests/${id}`).set('Authorization', `Bearer ${doctor.token}`).send({ status: 'REJECTED' });
    expect(res.status).toBe(400);
  });

  it('requires a reason when declining', async () => {
    const rx = await createFinalizedPrescription(doctor.doctorId, patient.patientId);
    const created = await request(app).post(`/api/v1/prescriptions/${rx.id}/refill-requests`).set('Authorization', `Bearer ${patient.token}`).send({});
    const id = created.body.data.request.id;

    const res = await request(app).patch(`/api/v1/doctor/refill-requests/${id}`).set('Authorization', `Bearer ${doctor.token}`).send({ status: 'DECLINED' });
    expect(res.status).toBe(400);
  });

  it('approves a request: clones a new DRAFT prescription with the original\'s items, and sends no notification yet', async () => {
    const rx = await createFinalizedPrescription(doctor.doctorId, patient.patientId, ['Metformin', 'Atorvastatin']);
    const created = await request(app).post(`/api/v1/prescriptions/${rx.id}/refill-requests`).set('Authorization', `Bearer ${patient.token}`).send({});
    const id = created.body.data.request.id;

    const res = await request(app).patch(`/api/v1/doctor/refill-requests/${id}`).set('Authorization', `Bearer ${doctor.token}`).send({ status: 'APPROVED' });
    expect(res.status).toBe(200);
    expect(res.body.data.request.status).toBe('APPROVED');
    expect(res.body.data.request.issuedPrescriptionId).not.toBeNull();

    const issued = await prisma.prescription.findUniqueOrThrow({
      where: { id: res.body.data.request.issuedPrescriptionId },
      include: { items: true },
    });
    expect(issued.status).toBe('DRAFT');
    expect(issued.patientId).toBe(patient.patientId);
    expect(issued.doctorId).toBe(doctor.doctorId);
    expect(issued.items.map((i) => i.medicineName).sort()).toEqual(['Atorvastatin', 'Metformin']);

    const notif = await prisma.notification.findFirst({ where: { relatedEntityType: 'PrescriptionRefillRequest', relatedEntityId: id } });
    expect(notif).toBeNull();

    const audit = await prisma.auditLog.findFirst({ where: { entityType: 'PrescriptionRefillRequest', entityId: id, action: 'doctor.refill_request_approved' } });
    expect(audit).not.toBeNull();
  });

  it('declines a request with a reason and notifies the patient exactly once', async () => {
    const rx = await createFinalizedPrescription(doctor.doctorId, patient.patientId);
    const created = await request(app).post(`/api/v1/prescriptions/${rx.id}/refill-requests`).set('Authorization', `Bearer ${patient.token}`).send({});
    const id = created.body.data.request.id;

    const res = await request(app)
      .patch(`/api/v1/doctor/refill-requests/${id}`)
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ status: 'DECLINED', doctorNote: 'Please book a follow-up visit before refilling' });
    expect(res.status).toBe(200);
    expect(res.body.data.request.status).toBe('DECLINED');
    expect(res.body.data.request.doctorNote).toBe('Please book a follow-up visit before refilling');
    expect(res.body.data.request.issuedPrescriptionId).toBeNull();

    const notif = await prisma.notification.findUnique({ where: { notificationKey: `refill-request:${id}:declined` } });
    expect(notif).not.toBeNull();
    expect(notif!.type).toBe('PRESCRIPTION_REFILL_DECLINED');
    expect(notif!.userId).toBe(patient.userId);

    const audit = await prisma.auditLog.findFirst({ where: { entityType: 'PrescriptionRefillRequest', entityId: id, action: 'doctor.refill_request_declined' } });
    expect(audit).not.toBeNull();
  });

  it('rejects responding twice to the same request', async () => {
    const rx = await createFinalizedPrescription(doctor.doctorId, patient.patientId);
    const created = await request(app).post(`/api/v1/prescriptions/${rx.id}/refill-requests`).set('Authorization', `Bearer ${patient.token}`).send({});
    const id = created.body.data.request.id;

    const first = await request(app).patch(`/api/v1/doctor/refill-requests/${id}`).set('Authorization', `Bearer ${doctor.token}`).send({ status: 'APPROVED' });
    expect(first.status).toBe(200);

    const second = await request(app)
      .patch(`/api/v1/doctor/refill-requests/${id}`)
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ status: 'DECLINED', doctorNote: 'Too late' });
    expect(second.status).toBe(409);
  });

  it('lists only refill requests for prescriptions the doctor issued', async () => {
    const rxMine = await createFinalizedPrescription(doctor.doctorId, patient.patientId);
    const rxOther = await createFinalizedPrescription(otherDoctor.doctorId, patient.patientId);
    await request(app).post(`/api/v1/prescriptions/${rxMine.id}/refill-requests`).set('Authorization', `Bearer ${patient.token}`).send({});
    await request(app).post(`/api/v1/prescriptions/${rxOther.id}/refill-requests`).set('Authorization', `Bearer ${patient.token}`).send({});

    const res = await request(app).get('/api/v1/doctor/refill-requests').set('Authorization', `Bearer ${doctor.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.every((r: { doctorId: string }) => r.doctorId === doctor.doctorId)).toBe(true);
  });
});

describe('MANDATORY: concurrent responses to the same refill request never corrupt state', () => {
  it('one approve and one decline racing the same pending request: exactly one wins, no orphaned side effects', async () => {
    const rx = await createFinalizedPrescription(doctor.doctorId, patient.patientId);
    const created = await request(app).post(`/api/v1/prescriptions/${rx.id}/refill-requests`).set('Authorization', `Bearer ${patient.token}`).send({});
    const id = created.body.data.request.id;

    const [approveRes, declineRes] = await Promise.all([
      request(app).patch(`/api/v1/doctor/refill-requests/${id}`).set('Authorization', `Bearer ${doctor.token}`).send({ status: 'APPROVED' }),
      request(app)
        .patch(`/api/v1/doctor/refill-requests/${id}`)
        .set('Authorization', `Bearer ${doctor.token}`)
        .send({ status: 'DECLINED', doctorNote: 'Racing decline' }),
    ]);

    const statuses = [approveRes.status, declineRes.status].sort();
    expect(statuses).toEqual([200, 409]);

    const final = await prisma.prescriptionRefillRequest.findUniqueOrThrow({ where: { id } });
    expect(['APPROVED', 'DECLINED']).toContain(final.status);

    if (final.status === 'APPROVED') {
      expect(final.issuedPrescriptionId).not.toBeNull();
      const issuedCount = await prisma.prescription.count({ where: { id: final.issuedPrescriptionId! } });
      expect(issuedCount).toBe(1);
      const declineNotif = await prisma.notification.findUnique({ where: { notificationKey: `refill-request:${id}:declined` } });
      expect(declineNotif).toBeNull();
    } else {
      expect(final.issuedPrescriptionId).toBeNull();
      const draftsForThisRequest = await prisma.prescription.count({
        where: { patientId: patient.patientId, doctorId: doctor.doctorId, status: 'DRAFT', notes: { contains: rx.id } },
      });
      expect(draftsForThisRequest).toBe(0);
    }
  });

  it('two concurrent decline responses to the same pending request produce exactly one notification', async () => {
    const rx = await createFinalizedPrescription(doctor.doctorId, patient.patientId);
    const created = await request(app).post(`/api/v1/prescriptions/${rx.id}/refill-requests`).set('Authorization', `Bearer ${patient.token}`).send({});
    const id = created.body.data.request.id;

    const [resA, resB] = await Promise.all([
      request(app).patch(`/api/v1/doctor/refill-requests/${id}`).set('Authorization', `Bearer ${doctor.token}`).send({ status: 'DECLINED', doctorNote: 'First' }),
      request(app).patch(`/api/v1/doctor/refill-requests/${id}`).set('Authorization', `Bearer ${doctor.token}`).send({ status: 'DECLINED', doctorNote: 'Second' }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);

    const notifCount = await prisma.notification.count({ where: { notificationKey: `refill-request:${id}:declined` } });
    expect(notifCount).toBe(1);
  });
});
