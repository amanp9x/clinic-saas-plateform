import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { UserRole } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');

const app = createApp();

let clinic: Awaited<ReturnType<typeof createDoctorFixture>>;
let admin: Awaited<ReturnType<typeof createReceptionFixture>>;

beforeAll(async () => {
  clinic = await createDoctorFixture(app);
  admin = await createReceptionFixture(app, clinic.clinicId, [], { role: UserRole.CLINIC_ADMIN });
});

describe('Departments', () => {
  it('creates a department', async () => {
    const res = await request(app)
      .post('/api/v1/clinic/departments')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, name: 'Pediatrics', description: 'Child healthcare' });
    expect(res.status).toBe(201);
    expect(res.body.data.department.name).toBe('Pediatrics');
  });

  it('rejects a duplicate department name within the same clinic', async () => {
    const res = await request(app)
      .post('/api/v1/clinic/departments')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, name: 'Pediatrics' });
    expect(res.status).toBe(409);
  });

  it('allows the same department name at a different clinic', async () => {
    const otherClinic = await createDoctorFixture(app);
    const otherAdmin = await createReceptionFixture(app, otherClinic.clinicId, [], { role: UserRole.CLINIC_ADMIN });
    const res = await request(app)
      .post('/api/v1/clinic/departments')
      .set('Authorization', `Bearer ${otherAdmin.token}`)
      .send({ clinicId: otherClinic.clinicId, name: 'Pediatrics' });
    expect(res.status).toBe(201);
  });

  it('deactivates and reactivates a department', async () => {
    const listRes = await request(app).get(`/api/v1/clinic/departments?clinicId=${clinic.clinicId}`).set('Authorization', `Bearer ${admin.token}`);
    const dept = listRes.body.data.departments.find((d: { name: string }) => d.name === 'Pediatrics');

    const deactivateRes = await request(app)
      .patch(`/api/v1/clinic/departments/${dept.id}?clinicId=${clinic.clinicId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false });
    expect(deactivateRes.status).toBe(200);
    expect(deactivateRes.body.data.department.isActive).toBe(false);
  });

  it('prevents deleting a department that still has services assigned', async () => {
    const listRes = await request(app).get(`/api/v1/clinic/departments?clinicId=${clinic.clinicId}`).set('Authorization', `Bearer ${admin.token}`);
    const dept = listRes.body.data.departments.find((d: { name: string }) => d.name === 'Pediatrics');

    await request(app)
      .post('/api/v1/clinic/services')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, name: 'Pediatric Checkup', departmentId: dept.id, durationMinutes: 20, price: 400 });

    const res = await request(app).delete(`/api/v1/clinic/departments/${dept.id}?clinicId=${clinic.clinicId}`).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(409);
  });
});

describe('Services', () => {
  it('creates, updates, and deactivates a service', async () => {
    const createRes = await request(app)
      .post('/api/v1/clinic/services')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, name: 'Vaccination', durationMinutes: 10, price: 250, taxApplicable: true });
    expect(createRes.status).toBe(201);
    const serviceId = createRes.body.data.service.id;

    const updateRes = await request(app)
      .patch(`/api/v1/clinic/services/${serviceId}?clinicId=${clinic.clinicId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ price: 300 });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.service.price).toBe('300');

    const deactivateRes = await request(app)
      .patch(`/api/v1/clinic/services/${serviceId}?clinicId=${clinic.clinicId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false });
    expect(deactivateRes.status).toBe(200);
    expect(deactivateRes.body.data.service.isActive).toBe(false);
  });

  it('rejects a duplicate service name within the same clinic', async () => {
    await request(app)
      .post('/api/v1/clinic/services')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, name: 'Health Checkup', durationMinutes: 30, price: 800 });

    const res = await request(app)
      .post('/api/v1/clinic/services')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, name: 'Health Checkup', durationMinutes: 15, price: 500 });
    expect(res.status).toBe(409);
  });
});
