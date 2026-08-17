import { describe, expect, it } from 'vitest';
import request from 'supertest';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture } = await import('../helpers/doctor-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

describe('GET /api/v1/reviews/eligible', () => {
  it('a completed appointment is eligible to review both doctor and clinic', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });

    const res = await request(app).get('/api/v1/reviews/eligible').query({ appointmentId: appt.id }).set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.eligibility.canReviewDoctor).toBe(true);
    expect(res.body.data.eligibility.canReviewClinic).toBe(true);
    expect(res.body.data.eligibility.existingDoctorReviewId).toBeNull();
    expect(res.body.data.eligibility.existingClinicReviewId).toBeNull();
  });

  it('a cancelled appointment is not eligible', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'CANCELLED' });

    const res = await request(app).get('/api/v1/reviews/eligible').query({ appointmentId: appt.id }).set('Authorization', `Bearer ${patient.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.eligibility.canReviewDoctor).toBe(false);
    expect(res.body.data.eligibility.canReviewClinic).toBe(false);
  });

  it('a no-show appointment is not eligible', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'NO_SHOW' });

    const res = await request(app).get('/api/v1/reviews/eligible').query({ appointmentId: appt.id }).set('Authorization', `Bearer ${patient.token}`);
    expect(res.body.data.eligibility.canReviewDoctor).toBe(false);
    expect(res.body.data.eligibility.canReviewClinic).toBe(false);
  });

  it('a still-pending appointment is not eligible', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'CONFIRMED' });

    const res = await request(app).get('/api/v1/reviews/eligible').query({ appointmentId: appt.id }).set('Authorization', `Bearer ${patient.token}`);
    expect(res.body.data.eligibility.canReviewDoctor).toBe(false);
  });

  it('a completed appointment whose linked consultation is not yet completed is not eligible ("where applicable" rule)', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const appt = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });
    await prisma.consultation.create({ data: { appointmentId: appt.id, doctorId: fixture.doctorId, patientId: patient.patientId, clinicId: fixture.clinicId, status: 'IN_PROGRESS' } });

    const res = await request(app).get('/api/v1/reviews/eligible').query({ appointmentId: appt.id }).set('Authorization', `Bearer ${patient.token}`);
    expect(res.body.data.eligibility.canReviewDoctor).toBe(false);
    expect(res.body.data.eligibility.canReviewClinic).toBe(false);
  });

  it('a patient cannot check eligibility for another patient\'s appointment — 404, not 403', async () => {
    const fixture = await createDoctorFixture(app);
    const owner = await createPatientFixture(app);
    const outsider = await createPatientFixture(app);
    const appt = await createAppointmentFixture({ patientId: owner.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'COMPLETED' });

    const res = await request(app).get('/api/v1/reviews/eligible').query({ appointmentId: appt.id }).set('Authorization', `Bearer ${outsider.token}`);
    expect(res.status).toBe(404);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/reviews/eligible').query({ appointmentId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(401);
  });

  it('a doctor/reception cannot use the patient eligibility endpoint', async () => {
    const fixture = await createDoctorFixture(app);
    const res = await request(app).get('/api/v1/reviews/eligible').query({ appointmentId: '00000000-0000-0000-0000-000000000000' }).set('Authorization', `Bearer ${fixture.token}`);
    expect(res.status).toBe(403);
  });
});
