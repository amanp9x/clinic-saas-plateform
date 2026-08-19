import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { UserRole } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture } = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

function isoDateDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60_000).toISOString().slice(0, 10);
}

async function adminFor(clinicId: string) {
  return createReceptionFixture(app, clinicId, [], { role: UserRole.CLINIC_ADMIN });
}

async function uploadDocument(token: string, clinicId: string, expiryDate?: string) {
  const req = request(app)
    .post('/api/v1/clinic/documents')
    .set('Authorization', `Bearer ${token}`)
    .field('clinicId', clinicId)
    .field('type', 'REGISTRATION_CERTIFICATE');
  if (expiryDate) req.field('expiryDate', expiryDate);
  const res = await req.attach('file', Buffer.from('%PDF-1.4 fake certificate'), { filename: 'cert.pdf', contentType: 'application/pdf' });
  expect(res.status).toBe(201);
  return res.body.data.document as { id: string; expiryDate: string | null; expiryStatus: string };
}

describe('POST /api/v1/clinic/documents — expiry at upload', () => {
  it('uploading without an expiry date is NOT_TRACKED', async () => {
    const fixture = await createDoctorFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const doc = await uploadDocument(admin.token, fixture.clinicId);
    expect(doc.expiryDate).toBeNull();
    expect(doc.expiryStatus).toBe('NOT_TRACKED');
  });

  it('uploading with a far-future expiry date is VALID', async () => {
    const fixture = await createDoctorFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const doc = await uploadDocument(admin.token, fixture.clinicId, isoDateDaysFromNow(200));
    expect(doc.expiryStatus).toBe('VALID');
  });

  it('uploading with an expiry date within 30 days is EXPIRING_SOON', async () => {
    const fixture = await createDoctorFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const doc = await uploadDocument(admin.token, fixture.clinicId, isoDateDaysFromNow(10));
    expect(doc.expiryStatus).toBe('EXPIRING_SOON');
  });

  it('uploading with a past expiry date is EXPIRED', async () => {
    const fixture = await createDoctorFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const doc = await uploadDocument(admin.token, fixture.clinicId, isoDateDaysFromNow(-5));
    expect(doc.expiryStatus).toBe('EXPIRED');
  });
});

describe('PATCH /api/v1/clinic/documents/:id/expiry', () => {
  it('sets an expiry date on an already-uploaded document', async () => {
    const fixture = await createDoctorFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const doc = await uploadDocument(admin.token, fixture.clinicId);

    const res = await request(app)
      .patch(`/api/v1/clinic/documents/${doc.id}/expiry`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: fixture.clinicId, expiryDate: isoDateDaysFromNow(15) });
    expect(res.status).toBe(200);
    expect(res.body.data.document.expiryStatus).toBe('EXPIRING_SOON');

    const auditRow = await prisma.auditLog.findFirst({ where: { entityType: 'ClinicDocument', entityId: doc.id, action: 'clinic.document_expiry_updated' } });
    expect(auditRow).not.toBeNull();
  });

  it('clears an expiry date by sending null', async () => {
    const fixture = await createDoctorFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const doc = await uploadDocument(admin.token, fixture.clinicId, isoDateDaysFromNow(15));

    const res = await request(app)
      .patch(`/api/v1/clinic/documents/${doc.id}/expiry`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ clinicId: fixture.clinicId, expiryDate: null });
    expect(res.status).toBe(200);
    expect(res.body.data.document.expiryDate).toBeNull();
    expect(res.body.data.document.expiryStatus).toBe('NOT_TRACKED');
  });

  it('a document belonging to a different clinic cannot be updated via a mismatched clinicId — 404, not leaking existence', async () => {
    const fixtureA = await createDoctorFixture(app);
    const fixtureB = await createDoctorFixture(app);
    const adminA = await adminFor(fixtureA.clinicId);
    const adminB = await adminFor(fixtureB.clinicId);
    const doc = await uploadDocument(adminA.token, fixtureA.clinicId);

    const res = await request(app)
      .patch(`/api/v1/clinic/documents/${doc.id}/expiry`)
      .set('Authorization', `Bearer ${adminB.token}`)
      .send({ clinicId: fixtureB.clinicId, expiryDate: isoDateDaysFromNow(10) });
    expect(res.status).toBe(404);
  });

  it('a receptionist without CLINIC_DOCUMENTS_MANAGE permission is rejected', async () => {
    const fixture = await createDoctorFixture(app);
    const admin = await adminFor(fixture.clinicId);
    const doc = await uploadDocument(admin.token, fixture.clinicId);
    const receptionist = await createReceptionFixture(app, fixture.clinicId, []);

    const res = await request(app)
      .patch(`/api/v1/clinic/documents/${doc.id}/expiry`)
      .set('Authorization', `Bearer ${receptionist.token}`)
      .send({ clinicId: fixture.clinicId, expiryDate: isoDateDaysFromNow(10) });
    expect(res.status).toBe(403);
  });
});
