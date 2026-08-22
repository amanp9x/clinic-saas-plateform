import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { CLINIC_PERMISSIONS } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

let doctor: Awaited<ReturnType<typeof createDoctorFixture>>;
let patient: Awaited<ReturnType<typeof createPatientFixture>>;
let reception: Awaited<ReturnType<typeof createReceptionFixture>>;

beforeAll(async () => {
  doctor = await createDoctorFixture(app);
  patient = await createPatientFixture(app);
  reception = await createReceptionFixture(app, doctor.clinicId, [CLINIC_PERMISSIONS.APPOINTMENT_MANAGE]);
});

/** Drives a fresh CONFIRMED appointment to IN_PROGRESS with real vitals/diagnosis saved, ready to
 * be completed via either call site (doctor's own button, or reception's queue action). */
async function setupInProgressConsultation(temperatureC = 38.2) {
  const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: doctor.doctorId, clinicId: doctor.clinicId, status: 'CONFIRMED' });

  const startRes = await request(app).post(`/api/v1/doctor/appointments/${appt.id}/start`).set('Authorization', `Bearer ${doctor.token}`);
  expect(startRes.status).toBe(200);

  const draftRes = await request(app)
    .put(`/api/v1/doctor/consultations/${appt.id}`)
    .set('Authorization', `Bearer ${doctor.token}`)
    .send({ diagnosis: 'Concurrency test diagnosis', vitals: { temperatureC } });
  expect(draftRes.status).toBe(200);
  expect(draftRes.body.data.consultation.status).toBe('IN_PROGRESS');

  return appt;
}

describe('Consultation completion — happy paths and duplicate-side-effect checks', () => {
  it('doctor completing their own consultation creates exactly one VitalRecord, one MedicalRecord, one audit entry, one notification', async () => {
    const appt = await setupInProgressConsultation(37.9);

    const res = await request(app).post(`/api/v1/doctor/consultations/${appt.id}/complete`).set('Authorization', `Bearer ${doctor.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.consultation.status).toBe('COMPLETED');

    const updatedAppointment = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    expect(updatedAppointment.status).toBe('COMPLETED');

    const vitals = await prisma.vitalRecord.findMany({ where: { patientId: patient.patientId, temperatureCelsius: 37.9 } });
    expect(vitals).toHaveLength(1);

    const medicalRecords = await prisma.medicalRecord.findMany({ where: { patientId: patient.patientId, doctorId: doctor.doctorId, recordDate: updatedAppointment.completedAt! } });
    expect(medicalRecords).toHaveLength(1);

    const auditRows = await prisma.auditLog.findMany({ where: { entityType: 'Consultation', entityId: res.body.data.consultation.id, action: 'queue.consultation_completed' } });
    expect(auditRows).toHaveLength(1);

    const notif = await prisma.notification.findUnique({ where: { notificationKey: `appointment:${appt.id}:consultation_completed` } });
    expect(notif).not.toBeNull();
  });

  it('reception completing via mark-completed produces the identical cascade', async () => {
    const appt = await setupInProgressConsultation(38.5);

    const res = await request(app)
      .post('/api/v1/reception/queue/mark-completed')
      .set('Authorization', `Bearer ${reception.token}`)
      .send({ clinicId: doctor.clinicId, doctorId: doctor.doctorId, appointmentId: appt.id });
    expect(res.status).toBe(200);

    const updatedAppointment = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    expect(updatedAppointment.status).toBe('COMPLETED');

    const vitals = await prisma.vitalRecord.findMany({ where: { patientId: patient.patientId, temperatureCelsius: 38.5 } });
    expect(vitals).toHaveLength(1);
  });

  it('rejects completing an already-completed consultation and creates no additional side effects', async () => {
    const appt = await setupInProgressConsultation(37.5);
    const first = await request(app).post(`/api/v1/doctor/consultations/${appt.id}/complete`).set('Authorization', `Bearer ${doctor.token}`);
    expect(first.status).toBe(200);

    const vitalsBefore = await prisma.vitalRecord.count({ where: { patientId: patient.patientId, temperatureCelsius: 37.5 } });

    const second = await request(app).post(`/api/v1/doctor/consultations/${appt.id}/complete`).set('Authorization', `Bearer ${doctor.token}`);
    expect(second.status).toBe(409);

    const vitalsAfter = await prisma.vitalRecord.count({ where: { patientId: patient.patientId, temperatureCelsius: 37.5 } });
    expect(vitalsAfter).toBe(vitalsBefore);
  });
});

describe(
  'MANDATORY: concurrent consultation-completion calls never double-apply the cascade',
  () => {
    it('doctor and reception racing the same consultation: exactly one wins, exactly one VitalRecord and one MedicalRecord are created', async () => {
      const appt = await setupInProgressConsultation(39.1);

      const [doctorRes, receptionRes] = await Promise.all([
        request(app).post(`/api/v1/doctor/consultations/${appt.id}/complete`).set('Authorization', `Bearer ${doctor.token}`),
        request(app)
          .post('/api/v1/reception/queue/mark-completed')
          .set('Authorization', `Bearer ${reception.token}`)
          .send({ clinicId: doctor.clinicId, doctorId: doctor.doctorId, appointmentId: appt.id }),
      ]);

      const statuses = [doctorRes.status, receptionRes.status].sort();
      expect(statuses).toEqual([200, 409]);

      const updatedAppointment = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
      expect(updatedAppointment.status).toBe('COMPLETED');

      const consultation = await prisma.consultation.findUniqueOrThrow({ where: { appointmentId: appt.id } });
      expect(consultation.status).toBe('COMPLETED');

      const vitals = await prisma.vitalRecord.findMany({ where: { patientId: patient.patientId, temperatureCelsius: 39.1 } });
      expect(vitals).toHaveLength(1);

      const medicalRecords = await prisma.medicalRecord.findMany({ where: { patientId: patient.patientId, doctorId: doctor.doctorId, recordDate: updatedAppointment.completedAt! } });
      expect(medicalRecords).toHaveLength(1);

      const notifCount = await prisma.notification.count({ where: { notificationKey: `appointment:${appt.id}:consultation_completed` } });
      expect(notifCount).toBe(1);
    }, 20000);

    it('two concurrent doctor-initiated complete calls on the same consultation: exactly one wins', async () => {
      const appt = await setupInProgressConsultation(38.0);

      const [resA, resB] = await Promise.all([
        request(app).post(`/api/v1/doctor/consultations/${appt.id}/complete`).set('Authorization', `Bearer ${doctor.token}`),
        request(app).post(`/api/v1/doctor/consultations/${appt.id}/complete`).set('Authorization', `Bearer ${doctor.token}`),
      ]);

      const statuses = [resA.status, resB.status].sort();
      expect(statuses).toEqual([200, 409]);

      const vitals = await prisma.vitalRecord.findMany({ where: { patientId: patient.patientId, temperatureCelsius: 38.0 } });
      expect(vitals).toHaveLength(1);
    }, 20000);
  },
);
