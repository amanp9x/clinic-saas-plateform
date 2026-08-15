import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { UserRole } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

let clinic: Awaited<ReturnType<typeof createDoctorFixture>>;
let admin: Awaited<ReturnType<typeof createReceptionFixture>>;

beforeAll(async () => {
  clinic = await createDoctorFixture(app);
  admin = await createReceptionFixture(app, clinic.clinicId, [], { role: UserRole.CLINIC_ADMIN });
});

describe('Clinic profile', () => {
  it('updates the clinic profile', async () => {
    const res = await request(app)
      .patch('/api/v1/clinic/profile')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, legalName: 'Test Clinic Pvt Ltd', establishedYear: 2015, languages: ['English', 'Hindi'] });
    expect(res.status).toBe(200);
    expect(res.body.data.clinic.legalName).toBe('Test Clinic Pvt Ltd');
    expect(res.body.data.clinic.establishedYear).toBe(2015);
  });

  it('submits clinic verification', async () => {
    const res = await request(app)
      .post('/api/v1/clinic/verification')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, notes: 'All documents attached' });
    expect(res.status).toBe(200);
    expect(res.body.data.clinic.verificationStatus).toBe('SUBMITTED');
  });
});

describe('Clinic status', () => {
  it('requires a reason to temporarily close the clinic', async () => {
    const res = await request(app)
      .patch('/api/v1/clinic/status')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, status: 'TEMPORARILY_CLOSED' });
    expect(res.status).toBe(400);
  });

  it('temporarily closes the clinic with a reason and writes an audit log', async () => {
    const res = await request(app)
      .patch('/api/v1/clinic/status')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, status: 'TEMPORARILY_CLOSED', reason: 'Maintenance work' });
    expect(res.status).toBe(200);
    expect(res.body.data.clinic.status).toBe('TEMPORARILY_CLOSED');
    expect(res.body.data.clinic.statusReason).toBe('Maintenance work');

    const auditRow = await prisma.auditLog.findFirst({ where: { action: 'clinic.status_updated', clinicId: clinic.clinicId }, orderBy: { createdAt: 'desc' } });
    expect(auditRow).toBeTruthy();
  });

  it('reopens the clinic', async () => {
    const res = await request(app)
      .patch('/api/v1/clinic/status')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, status: 'OPEN' });
    expect(res.status).toBe(200);
    expect(res.body.data.clinic.status).toBe('OPEN');
    expect(res.body.data.clinic.statusReason).toBeNull();
  });
});

describe('Clinic settings (queue configuration)', () => {
  it('returns default settings before any have been saved', async () => {
    const res = await request(app).get(`/api/v1/clinic/settings?clinicId=${clinic.clinicId}`).set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.settings.queueEnabled).toBe(true);
  });

  it('updates queue configuration', async () => {
    const res = await request(app)
      .patch('/api/v1/clinic/settings')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: clinic.clinicId, tokenPrefix: 'SUN', priorityQueueEnabled: false, defaultConsultationDurationMinutes: 20 });
    expect(res.status).toBe(200);
    expect(res.body.data.settings.tokenPrefix).toBe('SUN');
    expect(res.body.data.settings.priorityQueueEnabled).toBe(false);
    expect(res.body.data.settings.defaultConsultationDurationMinutes).toBe(20);
  });
});

describe('Clinic documents', () => {
  it('uploads, lists, downloads, and deletes a document', async () => {
    const uploadRes = await request(app)
      .post('/api/v1/clinic/documents')
      .set('Authorization', `Bearer ${admin.token}`)
      .field('clinicId', clinic.clinicId)
      .field('type', 'REGISTRATION_CERTIFICATE')
      .attach('file', Buffer.from('%PDF-1.4 fake certificate'), { filename: 'cert.pdf', contentType: 'application/pdf' });
    expect(uploadRes.status).toBe(201);
    const documentId = uploadRes.body.data.document.id;

    const listRes = await request(app).get(`/api/v1/clinic/documents?clinicId=${clinic.clinicId}`).set('Authorization', `Bearer ${admin.token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.documents.some((d: { id: string }) => d.id === documentId)).toBe(true);

    const downloadRes = await request(app)
      .get(`/api/v1/clinic/documents/${documentId}/download?clinicId=${clinic.clinicId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers['content-type']).toBe('application/pdf');

    const deleteRes = await request(app)
      .delete(`/api/v1/clinic/documents/${documentId}?clinicId=${clinic.clinicId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(deleteRes.status).toBe(200);
  });

  it('rejects a document type outside the allow-list', async () => {
    const res = await request(app)
      .post('/api/v1/clinic/documents')
      .set('Authorization', `Bearer ${admin.token}`)
      .field('clinicId', clinic.clinicId)
      .field('type', 'REGISTRATION_CERTIFICATE')
      .attach('file', Buffer.from('not a real doc'), { filename: 'malware.exe', contentType: 'application/x-msdownload' });
    expect(res.status).toBe(400);
  });
});
