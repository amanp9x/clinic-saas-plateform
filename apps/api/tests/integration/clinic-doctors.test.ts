import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { UserRole } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');

const app = createApp();

let clinic: Awaited<ReturnType<typeof createDoctorFixture>>;
let admin: Awaited<ReturnType<typeof createReceptionFixture>>;
let unassociatedDoctor: Awaited<ReturnType<typeof createDoctorFixture>>;

beforeAll(async () => {
  clinic = await createDoctorFixture(app);
  admin = await createReceptionFixture(app, clinic.clinicId, [], { role: UserRole.CLINIC_ADMIN });
  unassociatedDoctor = await createDoctorFixture(app);
});

describe('Existing-doctor search', () => {
  it('finds an existing doctor and flags whether already associated', async () => {
    const res = await request(app)
      .get(`/api/v1/clinic/doctors/search?clinicId=${clinic.clinicId}&q=Fixture`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.doctors.length).toBeGreaterThan(0);
  });
});

describe('Doctor-clinic association', () => {
  it('associates an existing doctor with the clinic (no duplicate Doctor account created)', async () => {
    const res = await request(app)
      .post('/api/v1/clinic/doctors')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, doctorId: unassociatedDoctor.doctorId, consultationTypes: ['IN_CLINIC', 'ONLINE'] });
    expect(res.status).toBe(201);
    expect(res.body.data.doctor.doctorId).toBe(unassociatedDoctor.doctorId);
    expect(res.body.data.doctor.status).toBe('ACTIVE');
  });

  it('rejects a duplicate association for the same doctor and clinic', async () => {
    const res = await request(app)
      .post('/api/v1/clinic/doctors')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, doctorId: unassociatedDoctor.doctorId, consultationTypes: ['IN_CLINIC'] });
    expect(res.status).toBe(409);
  });

  it('lists doctors at the clinic', async () => {
    const res = await request(app).get(`/api/v1/clinic/doctors?clinicId=${clinic.clinicId}`).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.doctors.items.some((d: { doctorId: string }) => d.doctorId === unassociatedDoctor.doctorId)).toBe(true);
  });

  it('updates the association (fee, department, consultation types)', async () => {
    const listRes = await request(app).get(`/api/v1/clinic/doctors?clinicId=${clinic.clinicId}`).set('Authorization', `Bearer ${admin.token}`);
    const entry = listRes.body.data.doctors.items.find((d: { doctorId: string }) => d.doctorId === unassociatedDoctor.doctorId);

    const res = await request(app)
      .patch(`/api/v1/clinic/doctors/${entry.clinicDoctorId}?clinicId=${clinic.clinicId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ consultationFeeOverride: 750, consultationTypes: ['IN_CLINIC'] });
    expect(res.status).toBe(200);
    expect(res.body.data.doctor.consultationFee).toBe('750');
  });

  it('suspends and reactivates the association', async () => {
    const listRes = await request(app).get(`/api/v1/clinic/doctors?clinicId=${clinic.clinicId}`).set('Authorization', `Bearer ${admin.token}`);
    const entry = listRes.body.data.doctors.items.find((d: { doctorId: string }) => d.doctorId === unassociatedDoctor.doctorId);

    const suspendRes = await request(app)
      .patch(`/api/v1/clinic/doctors/${entry.clinicDoctorId}/status?clinicId=${clinic.clinicId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'SUSPENDED' });
    expect(suspendRes.status).toBe(200);
    expect(suspendRes.body.data.doctor.status).toBe('SUSPENDED');

    const reactivateRes = await request(app)
      .patch(`/api/v1/clinic/doctors/${entry.clinicDoctorId}/status?clinicId=${clinic.clinicId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'ACTIVE' });
    expect(reactivateRes.status).toBe(200);
    expect(reactivateRes.body.data.doctor.status).toBe('ACTIVE');
  });

  it('removes the association', async () => {
    const listRes = await request(app).get(`/api/v1/clinic/doctors?clinicId=${clinic.clinicId}`).set('Authorization', `Bearer ${admin.token}`);
    const entry = listRes.body.data.doctors.items.find((d: { doctorId: string }) => d.doctorId === unassociatedDoctor.doctorId);

    const res = await request(app)
      .delete(`/api/v1/clinic/doctors/${entry.clinicDoctorId}?clinicId=${clinic.clinicId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);

    const afterRes = await request(app).get(`/api/v1/clinic/doctors?clinicId=${clinic.clinicId}`).set('Authorization', `Bearer ${admin.token}`);
    expect(afterRes.body.data.doctors.items.some((d: { doctorId: string }) => d.doctorId === unassociatedDoctor.doctorId)).toBe(false);
  });

  it('rejects associating a nonexistent doctor', async () => {
    const res = await request(app)
      .post('/api/v1/clinic/doctors')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, doctorId: '00000000-0000-0000-0000-000000000000', consultationTypes: ['IN_CLINIC'] });
    expect(res.status).toBe(404);
  });
});
