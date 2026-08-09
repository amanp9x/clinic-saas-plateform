import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

const { createApp } = await import('../../src/app.js');
const { prisma } = await import('../../src/config/database.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture } = await import(
  '../helpers/doctor-fixtures.js'
);

const app = createApp();

let doctor: Awaited<ReturnType<typeof createDoctorFixture>>;
let patient: Awaited<ReturnType<typeof createPatientFixture>>;

beforeAll(async () => {
  doctor = await createDoctorFixture(app);
  patient = await createPatientFixture(app);
});

describe('Consultation workflow', () => {
  it('cannot be fetched or edited before the appointment is started', async () => {
    const appt = await createAppointmentFixture({
      patientId: patient.patientId,
      doctorId: doctor.doctorId,
      clinicId: doctor.clinicId,
      status: 'CONFIRMED',
    });

    const getRes = await request(app)
      .get(`/api/v1/doctor/consultations/${appt.id}`)
      .set('Authorization', `Bearer ${doctor.token}`);
    expect(getRes.status).toBe(404);
  });

  it('saves a draft after start, then completes with cascading side effects', async () => {
    const appt = await createAppointmentFixture({
      patientId: patient.patientId,
      doctorId: doctor.doctorId,
      clinicId: doctor.clinicId,
      status: 'CONFIRMED',
      consultationFee: 600,
    });

    const startRes = await request(app)
      .post(`/api/v1/doctor/appointments/${appt.id}/start`)
      .set('Authorization', `Bearer ${doctor.token}`);
    expect(startRes.status).toBe(200);

    const draftRes = await request(app)
      .put(`/api/v1/doctor/consultations/${appt.id}`)
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({
        chiefComplaint: 'Fever and cough',
        symptoms: ['Fever', 'Cough'],
        vitals: { temperatureC: 38.2, pulseRate: 88 },
        diagnosis: 'Viral upper respiratory infection',
        doctorNotes: 'Advised rest and fluids',
        treatmentPlan: 'Paracetamol as needed',
        followUpDate: '2027-03-01',
      });
    expect(draftRes.status).toBe(200);
    expect(draftRes.body.data.consultation.status).toBe('IN_PROGRESS');
    expect(draftRes.body.data.consultation.diagnosis).toBe('Viral upper respiratory infection');

    const completeRes = await request(app)
      .post(`/api/v1/doctor/consultations/${appt.id}/complete`)
      .set('Authorization', `Bearer ${doctor.token}`);
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.consultation.status).toBe('COMPLETED');

    const updatedAppointment = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } });
    expect(updatedAppointment.status).toBe('COMPLETED');
    expect(updatedAppointment.completedAt).not.toBeNull();

    const vitalRecords = await prisma.vitalRecord.findMany({ where: { patientId: patient.patientId } });
    expect(vitalRecords.some((v) => v.temperatureCelsius === 38.2)).toBe(true);

    const medicalRecords = await prisma.medicalRecord.findMany({ where: { patientId: patient.patientId } });
    expect(medicalRecords.some((r) => r.doctorId === doctor.doctorId)).toBe(true);

    const secondCompleteRes = await request(app)
      .post(`/api/v1/doctor/consultations/${appt.id}/complete`)
      .set('Authorization', `Bearer ${doctor.token}`);
    expect(secondCompleteRes.status).toBe(409);

    const editAfterCompleteRes = await request(app)
      .put(`/api/v1/doctor/consultations/${appt.id}`)
      .set('Authorization', `Bearer ${doctor.token}`)
      .send({ doctorNotes: 'Trying to edit after completion' });
    expect(editAfterCompleteRes.status).toBe(409);
  });
});
