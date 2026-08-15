import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ConsultationType, Weekday } from '@prisma/client';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture } = await import('../helpers/doctor-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

let clinicId: string;
let clinicSlug: string;
let doctorId: string;

beforeAll(async () => {
  const fixture = await createDoctorFixture(app);
  clinicId = fixture.clinicId;
  doctorId = fixture.doctorId;

  const clinic = await prisma.clinic.update({
    where: { id: clinicId },
    data: { city: 'Mumbai', area: 'AndheriTestArea', isActive: true },
  });
  clinicSlug = clinic.slug;

  await prisma.doctor.update({
    where: { id: doctorId },
    data: { languages: ['Hindi', 'English'], ratingAverage: 4.9, ratingCount: 10 },
  });

  await prisma.clinicDoctor.update({
    where: { id: fixture.clinicDoctorId },
    data: {
      consultationTypes: [ConsultationType.IN_CLINIC, ConsultationType.ONLINE],
      availableDays: [Weekday.MON, Weekday.TUE, Weekday.WED, Weekday.THU, Weekday.FRI, Weekday.SAT, Weekday.SUN],
    },
  });

  await prisma.clinicService.create({
    data: { clinicId, name: 'X-Ray Test Service', durationMinutes: 20, price: 300 },
  });
});

describe('GET /api/v1/catalog/clinics/:slug', () => {
  it('returns clinic detail with doctors, area, and services', async () => {
    const res = await request(app).get(`/api/v1/catalog/clinics/${clinicSlug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.area).toBe('AndheriTestArea');
    expect(res.body.data.doctors.some((d: { id: string }) => d.id === doctorId)).toBe(true);
    expect(res.body.data.services.some((s: { name: string }) => s.name === 'X-Ray Test Service')).toBe(true);
  });

  it('returns 404 for an unknown slug', async () => {
    const res = await request(app).get('/api/v1/catalog/clinics/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/v1/catalog/specializations/:slug', () => {
  it('returns the seeded cardiologist specialization', async () => {
    const res = await request(app).get('/api/v1/catalog/specializations/cardiologist');
    expect(res.status).toBe(200);
    expect(res.body.data.slug).toBe('cardiologist');
  });

  it('returns 404 for an unknown slug', async () => {
    const res = await request(app).get('/api/v1/catalog/specializations/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/v1/catalog/doctors — extended filters', () => {
  it('filters by area', async () => {
    const res = await request(app).get('/api/v1/catalog/doctors?area=AndheriTestArea');
    expect(res.status).toBe(200);
    expect(res.body.data.items.some((d: { id: string }) => d.id === doctorId)).toBe(true);
    for (const doctor of res.body.data.items) {
      expect(doctor.area).toBe('AndheriTestArea');
    }
  });

  it('filters by language', async () => {
    // limit=50: default ratingCount-desc sort + a shared default-page-1 size can tie this
    // fixture's rating against leftover same-pattern fixture doctors from prior test runs
    // (never cleaned up between runs), so page through the max page size instead of page 1.
    const res = await request(app).get('/api/v1/catalog/doctors?languages=Hindi&limit=50');
    expect(res.status).toBe(200);
    expect(res.body.data.items.some((d: { id: string }) => d.id === doctorId)).toBe(true);
    for (const doctor of res.body.data.items) {
      expect(doctor.languages).toContain('Hindi');
    }
  });

  it('filters by consultation type', async () => {
    const res = await request(app).get('/api/v1/catalog/doctors?consultationType=ONLINE');
    expect(res.status).toBe(200);
    expect(res.body.data.items.some((d: { id: string }) => d.id === doctorId)).toBe(true);
  });

  it('filters by clinicId', async () => {
    const res = await request(app).get(`/api/v1/catalog/doctors?clinicId=${clinicId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.every((d: { id: string }) => d.id === doctorId)).toBe(true);
  });

  it('filters by availableThisWeek', async () => {
    const res = await request(app).get(`/api/v1/catalog/doctors?clinicId=${clinicId}&availableThisWeek=true`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.some((d: { id: string }) => d.id === doctorId)).toBe(true);
  });

  it('sorts by most reviewed', async () => {
    const res = await request(app).get('/api/v1/catalog/doctors?sort=most_reviewed&limit=50');
    expect(res.status).toBe(200);
    const counts = res.body.data.items.map((d: { ratingCount: number }) => d.ratingCount);
    const sorted = [...counts].sort((a: number, b: number) => b - a);
    expect(counts).toEqual(sorted);
  });

  it('accepts sort=availability without erroring', async () => {
    const res = await request(app).get('/api/v1/catalog/doctors?sort=availability&limit=10');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/v1/catalog/clinics — extended filters', () => {
  it('filters by area', async () => {
    const res = await request(app).get('/api/v1/catalog/clinics?area=AndheriTestArea');
    expect(res.status).toBe(200);
    expect(res.body.data.items.some((c: { id: string }) => c.id === clinicId)).toBe(true);
  });

  it('filters by minRating (has a doctor rated >= X)', async () => {
    const included = await request(app).get('/api/v1/catalog/clinics?area=AndheriTestArea&minRating=4.5');
    expect(included.body.data.items.some((c: { id: string }) => c.id === clinicId)).toBe(true);

    const excluded = await request(app).get('/api/v1/catalog/clinics?area=AndheriTestArea&minRating=5');
    expect(excluded.body.data.items.some((c: { id: string }) => c.id === clinicId)).toBe(false);
  });

  it('filters by service name', async () => {
    const res = await request(app).get('/api/v1/catalog/clinics?service=X-Ray');
    expect(res.status).toBe(200);
    expect(res.body.data.items.some((c: { id: string }) => c.id === clinicId)).toBe(true);
  });

  it('filters by consultation type', async () => {
    const res = await request(app).get('/api/v1/catalog/clinics?area=AndheriTestArea&consultationType=ONLINE');
    expect(res.status).toBe(200);
    expect(res.body.data.items.some((c: { id: string }) => c.id === clinicId)).toBe(true);
  });
});
