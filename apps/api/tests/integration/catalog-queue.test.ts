import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture } = await import('../helpers/doctor-fixtures.js');
const { prisma } = await import('../../src/config/database.js');
const { startOfDay } = await import('../../src/utils/date.js');
const { findForbiddenKeys, assertNoSubstrings } = await import('../helpers/assert-no-pii.js');

const app = createApp();

let activeDoctorSlug: string;
let activeClinicId: string;
let idleDoctorSlug: string;
let idleClinicId: string;
let otherClinicId: string;
let patientFullName: string;
let patientEmail: string;

beforeAll(async () => {
  const active = await createDoctorFixture(app);
  const idle = await createDoctorFixture(app);
  const other = await createDoctorFixture(app);
  const patient = await createPatientFixture(app);

  activeClinicId = active.clinicId;
  idleClinicId = idle.clinicId;
  otherClinicId = other.clinicId;

  const activeDoctor = await prisma.doctor.findUniqueOrThrow({ where: { id: active.doctorId } });
  activeDoctorSlug = activeDoctor.slug;
  const idleDoctor = await prisma.doctor.findUniqueOrThrow({ where: { id: idle.doctorId } });
  idleDoctorSlug = idleDoctor.slug;

  const patientUser = await prisma.user.findUniqueOrThrow({ where: { id: patient.userId } });
  patientEmail = patientUser.email!;
  const patientRow = await prisma.patient.findUniqueOrThrow({ where: { id: patient.patientId } });
  patientFullName = patientRow.fullName;

  const session = await prisma.doctorSession.create({
    data: {
      doctorId: active.doctorId,
      clinicId: activeClinicId,
      sessionDate: startOfDay(),
      status: 'IN_CONSULTATION',
      queueStatus: 'ACTIVE',
      averageConsultationMinutes: 15,
      delayMinutes: 5,
      delayReason: 'Running behind schedule',
    },
  });

  await prisma.queueToken.createMany({
    data: [
      { doctorSessionId: session.id, patientId: patient.patientId, tokenNumber: 1, status: 'COMPLETED' },
      { doctorSessionId: session.id, patientId: patient.patientId, tokenNumber: 2, status: 'WAITING' },
      { doctorSessionId: session.id, patientId: patient.patientId, tokenNumber: 3, status: 'WAITING' },
      { doctorSessionId: session.id, patientId: patient.patientId, tokenNumber: 4, status: 'WAITING' },
    ],
  });
  const currentToken = await prisma.queueToken.create({
    data: { doctorSessionId: session.id, patientId: patient.patientId, tokenNumber: 5, status: 'CALLED' },
  });
  await prisma.doctorSession.update({
    where: { id: session.id },
    data: { currentTokenId: currentToken.id },
  });
});

describe('GET /api/v1/catalog/doctors/:slug/queue', () => {
  it('returns an honest inactive status when no session exists today', async () => {
    const res = await request(app).get(`/api/v1/catalog/doctors/${idleDoctorSlug}/queue?clinicId=${idleClinicId}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      isActive: false,
      currentToken: null,
      patientsAhead: null,
      estimatedWaitMinutes: null,
      delayMinutes: null,
      delayReason: null,
    });
  });

  it('returns aggregate-only queue data for an active session', async () => {
    const res = await request(app).get(`/api/v1/catalog/doctors/${activeDoctorSlug}/queue?clinicId=${activeClinicId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(true);
    expect(res.body.data.patientsAhead).toBe(3);
    expect(res.body.data.currentToken).toBe('5');
    expect(typeof res.body.data.currentToken).toBe('string');
    expect(res.body.data.delayMinutes).toBe(5);
    expect(res.body.data.delayReason).toBe('Running behind schedule');
    expect(typeof res.body.data.estimatedWaitMinutes).toBe('number');
  });

  it('never leaks patient-identifying data in the queue response', async () => {
    const res = await request(app).get(`/api/v1/catalog/doctors/${activeDoctorSlug}/queue?clinicId=${activeClinicId}`);
    expect(findForbiddenKeys(res.body)).toEqual([]);
    assertNoSubstrings(res.body, [patientFullName, patientEmail]);
  });

  it('rejects a missing clinicId', async () => {
    const res = await request(app).get(`/api/v1/catalog/doctors/${activeDoctorSlug}/queue`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for an unknown doctor slug', async () => {
    const res = await request(app).get(`/api/v1/catalog/doctors/does-not-exist/queue?clinicId=${activeClinicId}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 when the doctor is not affiliated with the given clinic', async () => {
    const res = await request(app).get(`/api/v1/catalog/doctors/${activeDoctorSlug}/queue?clinicId=${otherClinicId}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/catalog/doctors/:slug — privacy', () => {
  it('never leaks patient-identifying data through the doctor detail response', async () => {
    const res = await request(app).get(`/api/v1/catalog/doctors/${activeDoctorSlug}`);
    expect(res.status).toBe(200);
    expect(findForbiddenKeys(res.body)).toEqual([]);
    assertNoSubstrings(res.body, [patientFullName, patientEmail]);
  });
});
