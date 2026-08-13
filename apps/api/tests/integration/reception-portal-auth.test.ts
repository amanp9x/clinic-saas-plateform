import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ALL_CLINIC_PERMISSIONS } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');

const app = createApp();

let doctorA: Awaited<ReturnType<typeof createDoctorFixture>>;
let doctorB: Awaited<ReturnType<typeof createDoctorFixture>>;
let receptionistFull: Awaited<ReturnType<typeof createReceptionFixture>>;
let receptionistNoPermissions: Awaited<ReturnType<typeof createReceptionFixture>>;

beforeAll(async () => {
  doctorA = await createDoctorFixture(app);
  doctorB = await createDoctorFixture(app);
  receptionistFull = await createReceptionFixture(app, doctorA.clinicId, ALL_CLINIC_PERMISSIONS);
  receptionistNoPermissions = await createReceptionFixture(app, doctorA.clinicId, []);
});

describe('Reception Portal authorization', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get(`/api/v1/reception/dashboard?clinicId=${doctorA.clinicId}`);
    expect(res.status).toBe(401);
  });

  it('rejects a DOCTOR-role token — reception routes require a staff role', async () => {
    const res = await request(app)
      .get(`/api/v1/reception/queue?clinicId=${doctorA.clinicId}&doctorId=${doctorA.doctorId}`)
      .set('Authorization', `Bearer ${doctorA.token}`);
    expect(res.status).toBe(403);
  });

  it('rejects a receptionist missing the queue.view permission for the clinic', async () => {
    const res = await request(app)
      .get(`/api/v1/reception/queue?clinicId=${doctorA.clinicId}&doctorId=${doctorA.doctorId}`)
      .set('Authorization', `Bearer ${receptionistNoPermissions.token}`);
    expect(res.status).toBe(403);
  });

  it('allows a fully-permissioned receptionist', async () => {
    const res = await request(app)
      .get(`/api/v1/reception/queue?clinicId=${doctorA.clinicId}&doctorId=${doctorA.doctorId}`)
      .set('Authorization', `Bearer ${receptionistFull.token}`);
    expect(res.status).toBe(200);
  });

  it('isolates clinics — a receptionist at clinic A never gets clinic B queue data', async () => {
    const res = await request(app)
      .get(`/api/v1/reception/queue?clinicId=${doctorB.clinicId}&doctorId=${doctorB.doctorId}`)
      .set('Authorization', `Bearer ${receptionistFull.token}`);
    expect(res.status).toBe(403);
  });

  it('rejects a doctorId that is not associated with the given clinic', async () => {
    const res = await request(app)
      .get(`/api/v1/reception/queue?clinicId=${doctorA.clinicId}&doctorId=${doctorB.doctorId}`)
      .set('Authorization', `Bearer ${receptionistFull.token}`);
    expect(res.status).toBe(404);
  });

  it('a CLINIC_ADMIN at the clinic bypasses individual permission keys', async () => {
    const { UserRole } = await import('@clinic/shared');
    const admin = await createReceptionFixture(app, doctorA.clinicId, [], { role: UserRole.CLINIC_ADMIN });
    const res = await request(app)
      .get(`/api/v1/reception/queue?clinicId=${doctorA.clinicId}&doctorId=${doctorA.doctorId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
  });
});
