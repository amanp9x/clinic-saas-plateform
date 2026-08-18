import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { UserRole } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPlatformAdminFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

async function uploadDocument(clinicAdminToken: string, clinicId: string) {
  const res = await request(app)
    .post('/api/v1/clinic/documents')
    .set('Authorization', `Bearer ${clinicAdminToken}`)
    .field('clinicId', clinicId)
    .field('type', 'REGISTRATION_CERTIFICATE')
    .attach('file', Buffer.from('%PDF-1.4 fake certificate'), { filename: 'cert.pdf', contentType: 'application/pdf' });
  expect(res.status).toBe(201);
  return res.body.data.document.id as string;
}

describe('PATCH /api/v1/platform-admin/clinics/:id/documents/:documentId', () => {
  it('verifies a document', async () => {
    const admin = await createPlatformAdminFixture(app);
    const fixture = await createDoctorFixture(app);
    const clinicAdmin = await createReceptionFixture(app, fixture.clinicId, [], { role: UserRole.CLINIC_ADMIN });
    const documentId = await uploadDocument(clinicAdmin.token, fixture.clinicId);

    const res = await request(app)
      .patch(`/api/v1/platform-admin/clinics/${fixture.clinicId}/documents/${documentId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'VERIFIED' });
    expect(res.status).toBe(200);

    const doc = await prisma.clinicDocument.findUniqueOrThrow({ where: { id: documentId } });
    expect(doc.status).toBe('VERIFIED');
  });

  it('rejects a document with a reason', async () => {
    const admin = await createPlatformAdminFixture(app);
    const fixture = await createDoctorFixture(app);
    const clinicAdmin = await createReceptionFixture(app, fixture.clinicId, [], { role: UserRole.CLINIC_ADMIN });
    const documentId = await uploadDocument(clinicAdmin.token, fixture.clinicId);

    const res = await request(app)
      .patch(`/api/v1/platform-admin/clinics/${fixture.clinicId}/documents/${documentId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'REJECTED', notes: 'Blurry scan' });
    expect(res.status).toBe(200);

    const auditRow = await prisma.auditLog.findFirst({ where: { entityType: 'ClinicDocument', entityId: documentId, action: 'platform.clinic_document_rejected' } });
    expect(auditRow).not.toBeNull();
  });

  it('a document that belongs to a different clinic cannot be reviewed via a mismatched clinicId — 404', async () => {
    const admin = await createPlatformAdminFixture(app);
    const fixtureA = await createDoctorFixture(app);
    const fixtureB = await createDoctorFixture(app);
    const clinicAdminA = await createReceptionFixture(app, fixtureA.clinicId, [], { role: UserRole.CLINIC_ADMIN });
    const documentId = await uploadDocument(clinicAdminA.token, fixtureA.clinicId);

    const res = await request(app)
      .patch(`/api/v1/platform-admin/clinics/${fixtureB.clinicId}/documents/${documentId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ status: 'VERIFIED' });
    expect(res.status).toBe(404);

    const doc = await prisma.clinicDocument.findUniqueOrThrow({ where: { id: documentId } });
    expect(doc.status).toBe('UPLOADED');
  });

  it('a non-platform-admin cannot review documents', async () => {
    const fixture = await createDoctorFixture(app);
    const clinicAdmin = await createReceptionFixture(app, fixture.clinicId, [], { role: UserRole.CLINIC_ADMIN });
    const documentId = await uploadDocument(clinicAdmin.token, fixture.clinicId);

    const res = await request(app)
      .patch(`/api/v1/platform-admin/clinics/${fixture.clinicId}/documents/${documentId}`)
      .set('Authorization', `Bearer ${clinicAdmin.token}`)
      .send({ status: 'VERIFIED' });
    expect(res.status).toBe(403);
  });
});
